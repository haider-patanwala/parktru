import { unwrapApiResult } from "@/features/operator-operations/lib/operator-operations.helpers";
import {
	mergeSessionMapping,
	type OutboxItem,
	getSyncPaused,
	loadLastActiveUserId,
	loadOperatorContext,
	loadOutbox,
	replaceOutbox,
	resolveSessionIdForServer,
	saveOperatorContext,
	saveSessionLists,
	setSyncPaused,
} from "@/features/operator-operations/sync/operator.store";
import { eden } from "@/server/eden";

const LOCK_NAME = "parktru-operator-sync";
const CHANNEL_NAME = "parktru-operator-sync";

let started = false;

function broadcastKick() {
	if (typeof BroadcastChannel === "undefined") return;
	const ch = new BroadcastChannel(CHANNEL_NAME);
	ch.postMessage({ type: "kick" });
	ch.close();
}

export function kickOperatorSync() {
	broadcastKick();
	void flushOutboxForActiveUser();
}

async function resolveFlushUserId(): Promise<string | null> {
	try {
		const ctx = unwrapApiResult(await eden.operator.context.get());
		if (ctx.user?.id) {
			return ctx.user.id;
		}
	} catch {
		/* offline or unauthorized */
	}
	return (await loadLastActiveUserId()) ?? null;
}

async function processOne(
	userId: string,
	item: OutboxItem,
): Promise<{ continue: boolean }> {
	const resolvedPayload = (p: Record<string, unknown>) => {
		const next = { ...p };
		if (typeof next.parkingSessionId === "string") {
			next.parkingSessionId = next.parkingSessionId;
		}
		return next;
	};

	switch (item.kind) {
		case "bootstrap": {
			const body = item.payload as {
				baseRate: number;
				initialLotName: string;
				tenantName: string;
			};
			const ctx = unwrapApiResult(
				await eden.operator.bootstrap.post({
					...body,
					idempotencyKey: item.idempotencyKey,
				}),
			);
			await saveOperatorContext(userId, ctx);
			return { continue: true };
		}
		case "select-lot": {
			const body = item.payload as { parkingLotId: string };
			const ctx = unwrapApiResult(
				await eden.operator["select-lot"].post({
					...body,
					idempotencyKey: item.idempotencyKey,
				}),
			);
			await saveOperatorContext(userId, ctx);
			return { continue: true };
		}
		case "select-gate": {
			const body = item.payload as { parkingGateId: string };
			const ctx = unwrapApiResult(
				await eden.operator["select-gate"].post({
					...body,
					idempotencyKey: item.idempotencyKey,
				}),
			);
			await saveOperatorContext(userId, ctx);
			return { continue: true };
		}
		case "parking-lot": {
			const body = item.payload as { baseRate?: number; name: string };
			const ctx = unwrapApiResult(
				await eden.operator["parking-lot"].post({
					...body,
					idempotencyKey: item.idempotencyKey,
				}),
			);
			await saveOperatorContext(userId, ctx);
			return { continue: true };
		}
		case "parking-gate": {
			const body = item.payload as { name: string; parkingLotId: string };
			const ctx = unwrapApiResult(
				await eden.operator["parking-gate"].post({
					...body,
					idempotencyKey: item.idempotencyKey,
				}),
			);
			await saveOperatorContext(userId, ctx);
			return { continue: true };
		}
		case "lot-rate": {
			const body = item.payload as {
				baseRate: number;
				countryCode?: string;
				currencyCode?: string;
				parkingLotId: string;
			};
			await unwrapApiResult(
				await eden.operator["lot-rate"].post({
					...body,
					idempotencyKey: item.idempotencyKey,
				}),
			);
			const ctx = unwrapApiResult(await eden.operator.context.get());
			await saveOperatorContext(userId, ctx);
			return { continue: true };
		}
		case "entry": {
			const body = item.payload as {
				clientMutationId?: string;
				customerName: string;
				customerPhone: string;
				displayPlateNumber: string;
				nationalityCode?: string;
				parkingGateId?: string;
				parkingLotId: string;
				vehicleType?: string;
			};
			const result = await unwrapApiResult(
				await eden.operator.entry.post({
					...body,
					idempotencyKey: item.idempotencyKey,
				}),
			);
			if ("invalidGate" in result && result.invalidGate) {
				return { continue: true };
			}
			if (
				result.created &&
				"session" in result &&
				result.session &&
				body.clientMutationId
			) {
				await mergeSessionMapping(
					userId,
					body.clientMutationId,
					result.session.id,
				);
			}
			const lotId = body.parkingLotId;
			const lists = unwrapApiResult(
				await eden.operator.sessions.get({
					query: { parkingLotId: lotId },
				}),
			);
			await saveSessionLists(userId, lotId, lists);
			return { continue: true };
		}
		case "entry-time": {
			const body = resolvedPayload(item.payload as Record<string, unknown>) as {
				entryAt: string;
				parkingSessionId: string;
			};
			const sid = await resolveSessionIdForServer(userId, body.parkingSessionId);
			await unwrapApiResult(
				await eden.operator["entry-time"].post({
					entryAt: body.entryAt,
					idempotencyKey: item.idempotencyKey,
					parkingSessionId: sid,
				}),
			);
			const ctx = await loadOperatorContext(userId);
			const lotId =
				ctx?.selectedParkingLotId ?? ctx?.allowedLots[0]?.id ?? null;
			if (lotId) {
				const lists = unwrapApiResult(
					await eden.operator.sessions.get({
						query: { parkingLotId: lotId },
					}),
				);
				await saveSessionLists(userId, lotId, lists);
			}
			return { continue: true };
		}
		case "exit": {
			const body = item.payload as {
				finalAmount: number;
				overrideAmount?: number;
				parkingSessionId: string;
			};
			const sid = await resolveSessionIdForServer(userId, body.parkingSessionId);
			await unwrapApiResult(
				await eden.operator.exit.post({
					finalAmount: body.finalAmount,
					idempotencyKey: item.idempotencyKey,
					overrideAmount: body.overrideAmount,
					parkingSessionId: sid,
				}),
			);
			const ctx = await loadOperatorContext(userId);
			const lotId =
				ctx?.selectedParkingLotId ?? ctx?.allowedLots[0]?.id ?? null;
			if (lotId) {
				const lists = unwrapApiResult(
					await eden.operator.sessions.get({
						query: { parkingLotId: lotId },
					}),
				);
				await saveSessionLists(userId, lotId, lists);
			}
			return { continue: true };
		}
		case "receipt-link": {
			const body = item.payload as { parkingSessionId: string };
			const sid = await resolveSessionIdForServer(userId, body.parkingSessionId);
			await unwrapApiResult(
				await eden.operator.receipt.link.post({
					idempotencyKey: item.idempotencyKey,
					parkingSessionId: sid,
				}),
			);
			return { continue: true };
		}
		default:
			return { continue: true };
	}
}

async function flushWithUserId(userId: string) {
	if (await getSyncPaused(userId)) {
		return;
	}
	let queue = await loadOutbox(userId);
	let backoff = 500;
	const maxBackoff = 8000;

	while (queue.length > 0) {
		if (typeof navigator !== "undefined" && !navigator.onLine) {
			return;
		}

		const [head, ...rest] = queue;
		if (!head) break;

		try {
			await processOne(userId, head);
			queue = rest;
			await replaceOutbox(userId, queue);
			backoff = 500;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			const isAuth =
				msg.includes("401") ||
				msg.includes("Sign in") ||
				msg.toLowerCase().includes("unauthorized");
			if (isAuth) {
				await setSyncPaused(userId, true);
				return;
			}
			head.attempts += 1;
			if (head.attempts > 12) {
				queue = rest;
				await replaceOutbox(userId, queue);
				continue;
			}
			queue = [{ ...head, attempts: head.attempts }, ...rest];
			await replaceOutbox(userId, queue);
			await new Promise((r) => setTimeout(r, backoff));
			backoff = Math.min(maxBackoff, backoff * 2);
		}
	}
}

export async function flushOutboxForActiveUser() {
	const userId = await resolveFlushUserId();
	if (!userId) return;

	if (typeof navigator !== "undefined" && navigator.locks) {
		await navigator.locks.request(LOCK_NAME, async () => {
			await flushWithUserId(userId);
		});
	} else {
		await flushWithUserId(userId);
	}
}

export function startOperatorSyncEngine() {
	if (started) return;
	started = true;
	if (typeof window === "undefined") return;

	void flushOutboxForActiveUser();

	window.addEventListener("online", () => {
		void flushOutboxForActiveUser();
	});

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") {
			void flushOutboxForActiveUser();
		}
	});

	setInterval(
		() => {
			void flushOutboxForActiveUser();
		},
		60_000,
	);

	if (typeof BroadcastChannel !== "undefined") {
		const ch = new BroadcastChannel(CHANNEL_NAME);
		ch.addEventListener("message", () => {
			void flushOutboxForActiveUser();
		});
	}
}
