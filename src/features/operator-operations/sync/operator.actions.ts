import {
	normalizePlateNumber,
	unwrapApiResult,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	LotReport,
	OperatorContext,
	PlateLookupResult,
	SessionLists,
	SessionSnapshot,
} from "@/features/operator-operations/models/operator-operations.types";
import {
	enqueueOutbox,
	loadLotReport,
	loadOperatorContext,
	loadSessionLists,
	type OutboxItem,
	saveLotReport,
	saveOperatorContext,
	saveSessionLists,
} from "@/features/operator-operations/sync/operator.store";
import { kickOperatorSync } from "@/features/operator-operations/sync/operator.sync-engine";
import { eden } from "@/server/eden";

function newCommandId() {
	return crypto.randomUUID();
}

function newIdempotencyKey() {
	return crypto.randomUUID();
}

function isOnline() {
	return typeof navigator !== "undefined" && navigator.onLine;
}

/** Avoid hanging when `navigator.onLine` is wrong or the network stalls (offline / captive portal). */
const NETWORK_TIMEOUT_MS = 12_000;

async function tryPost<T>(run: () => Promise<T>): Promise<T | null> {
	if (!isOnline()) {
		return null;
	}
	try {
		const result = await Promise.race([
			run(),
			new Promise<"timeout">((resolve) => {
				setTimeout(() => resolve("timeout"), NETWORK_TIMEOUT_MS);
			}),
		]);
		if (result === "timeout") {
			return null;
		}
		return result;
	} catch {
		return null;
	}
}

export function mergeSessionIntoLists(
	lists: SessionLists,
	snapshot: SessionSnapshot,
): SessionLists {
	const activeOthers = lists.activeSessions.filter((s) => s.id !== snapshot.id);
	const recentOthers = lists.recentSessions.filter((s) => s.id !== snapshot.id);
	if (snapshot.status === "active") {
		return {
			activeSessions: [snapshot, ...activeOthers],
			recentSessions: recentOthers,
		};
	}
	return {
		activeSessions: activeOthers,
		recentSessions: [snapshot, ...recentOthers].slice(0, 8),
	};
}

export async function persistOperatorContextFromServer(
	userId: string,
	context: OperatorContext,
) {
	await saveOperatorContext(userId, context);
}

export async function persistSessionListsFromServer(
	userId: string,
	parkingLotId: string,
	lists: SessionLists,
) {
	await saveSessionLists(userId, parkingLotId, lists);
}

export async function persistLotReportFromServer(
	userId: string,
	parkingLotId: string,
	report: LotReport,
) {
	await saveLotReport(userId, parkingLotId, report);
}

export async function localLookupPlate(input: {
	parkingLotId: string;
	plateNumber: string;
	tenantId: string;
	userId: string;
}): Promise<PlateLookupResult | null> {
	const lists = await loadSessionLists(input.userId, input.parkingLotId);
	if (!lists) return null;
	const normalizedPlateNumber = normalizePlateNumber(input.plateNumber);
	const pool = [...lists.activeSessions, ...lists.recentSessions].filter(
		(s) => s.parkingLotId === input.parkingLotId,
	);
	const activeSession =
		pool.find(
			(s) =>
				normalizePlateNumber(s.displayPlateNumber) === normalizedPlateNumber &&
				s.status === "active",
		) ?? null;
	const recentMatches = pool
		.filter(
			(s) =>
				normalizePlateNumber(s.displayPlateNumber) === normalizedPlateNumber,
		)
		.slice(0, 5);
	const mostRecentMatch = recentMatches[0];
	return {
		activeSession,
		customerDefaults: mostRecentMatch
			? {
					customerName: mostRecentMatch.customerName ?? "",
					customerPhone: mostRecentMatch.customerPhone ?? "",
				}
			: null,
		normalizedPlateNumber,
		recentMatches,
	};
}

export async function postEntryWithOffline(input: {
	customerName: string;
	customerPhone: string;
	displayPlateNumber: string;
	nationalityCode: string;
	operatorContext: OperatorContext;
	parkingGateId?: string | null;
	parkingLotId: string;
	userId: string;
	vehicleType?: string;
}): Promise<{
	created: boolean;
	duplicateSession: SessionSnapshot | null;
	invalidGate?: true;
	session?: SessionSnapshot;
}> {
	const idempotencyKey = newIdempotencyKey();
	const clientMutationId = newCommandId();
	const tenantId = input.operatorContext.tenant?.id;
	if (!tenantId) {
		throw new Error("Create an operator workspace before creating entries.");
	}

	const gatesForLot = input.operatorContext.gatesForSelectedLot ?? [];
	const resolvedGateId =
		input.parkingGateId ?? input.operatorContext.selectedParkingGateId ?? null;
	if (gatesForLot.length > 0 && resolvedGateId) {
		const gateOk = gatesForLot.some((g) => g.id === resolvedGateId);
		if (!gateOk) {
			return { created: false, duplicateSession: null, invalidGate: true };
		}
	}

	const activeLot = input.operatorContext.allowedLots.find(
		(l) => l.id === input.parkingLotId,
	);
	const gate =
		input.operatorContext.gatesForSelectedLot?.find(
			(g) =>
				g.id ===
				(input.parkingGateId ?? input.operatorContext.selectedParkingGateId),
		) ?? input.operatorContext.gatesForSelectedLot?.[0];
	const normalizedPlateNumber = normalizePlateNumber(input.displayPlateNumber);
	const lists = (await loadSessionLists(input.userId, input.parkingLotId)) ?? {
		activeSessions: [],
		recentSessions: [],
	};
	const duplicate = lists.activeSessions.find(
		(s) =>
			normalizePlateNumber(s.displayPlateNumber) === normalizedPlateNumber &&
			s.status === "active",
	);
	if (duplicate) {
		return { created: false, duplicateSession: duplicate };
	}

	const entryAt = new Date().toISOString();
	const nat = input.nationalityCode.trim().toUpperCase();
	const snapshot: SessionSnapshot = {
		baseRateSnapshot: activeLot?.baseRate ?? 0,
		customerName: input.customerName.trim(),
		customerPhone: input.customerPhone.trim(),
		nationalityCode: nat,
		displayPlateNumber: input.displayPlateNumber.trim(),
		entryAt,
		exitAt: null,
		finalAmount: null,
		id: clientMutationId,
		overrideAmount: null,
		parkingGateId: gate?.id ?? input.parkingGateId ?? null,
		parkingGateName: gate?.name ?? null,
		parkingLotId: input.parkingLotId,
		parkingLotName: activeLot?.name ?? "Parking lot",
		status: "active",
	};

	await saveSessionLists(
		input.userId,
		input.parkingLotId,
		mergeSessionIntoLists(lists, snapshot),
	);

	const item: OutboxItem = {
		attempts: 0,
		createdAt: Date.now(),
		id: newCommandId(),
		idempotencyKey,
		kind: "entry",
		payload: {
			clientMutationId,
			customerName: input.customerName,
			customerPhone: input.customerPhone,
			displayPlateNumber: input.displayPlateNumber,
			nationalityCode: nat,
			parkingGateId: input.parkingGateId ?? undefined,
			parkingLotId: input.parkingLotId,
			vehicleType: input.vehicleType,
		},
	};
	await enqueueOutbox(input.userId, item);
	kickOperatorSync();

	return {
		created: true,
		duplicateSession: null,
		session: snapshot,
	};
}

export async function postExitWithOffline(input: {
	finalAmount: number;
	operatorContext: OperatorContext;
	overrideAmount?: number | null;
	parkingSessionId: string;
	userId: string;
}): Promise<{
	amount: number;
	customerName: string;
	customerPhone: string;
	entryAt: string;
	exitAt: string;
	operatorName: string;
	parkingLotName: string;
	plateNumber: string;
	tenantName: string;
} | null> {
	const idempotencyKey = newIdempotencyKey();
	const tenantId = input.operatorContext.tenant?.id;
	if (!tenantId) return null;

	const lotId =
		input.operatorContext.selectedParkingLotId ??
		input.operatorContext.allowedLots[0]?.id ??
		null;
	if (!lotId) return null;

	const online = await tryPost(async () =>
		unwrapApiResult(
			await eden.operator.exit.post({
				finalAmount: input.finalAmount,
				idempotencyKey,
				overrideAmount: input.overrideAmount ?? undefined,
				parkingSessionId: input.parkingSessionId,
			}),
		),
	);

	if (online) {
		const lists = await loadSessionLists(input.userId, lotId);
		if (lists) {
			const fresh = await tryPost(async () =>
				unwrapApiResult(
					await eden.operator.sessions.get({
						query: { parkingLotId: lotId },
					}),
				),
			);
			if (fresh) {
				await saveSessionLists(input.userId, lotId, fresh);
			}
		}
		return online;
	}

	const lists = (await loadSessionLists(input.userId, lotId)) ?? {
		activeSessions: [],
		recentSessions: [],
	};
	const session =
		lists.activeSessions.find((s) => s.id === input.parkingSessionId) ??
		lists.recentSessions.find((s) => s.id === input.parkingSessionId);
	if (!session) {
		return null;
	}

	const exitAt = new Date().toISOString();
	const closed: SessionSnapshot = {
		...session,
		exitAt,
		finalAmount: input.finalAmount,
		overrideAmount: input.overrideAmount ?? null,
		status: "closed",
	};

	const nextLists: SessionLists = {
		activeSessions: lists.activeSessions.filter((s) => s.id !== session.id),
		recentSessions: [
			closed,
			...lists.recentSessions.filter((s) => s.id !== session.id),
		].slice(0, 8),
	};
	await saveSessionLists(input.userId, lotId, nextLists);

	const item: OutboxItem = {
		attempts: 0,
		createdAt: Date.now(),
		id: newCommandId(),
		idempotencyKey,
		kind: "exit",
		payload: {
			finalAmount: input.finalAmount,
			overrideAmount: input.overrideAmount ?? undefined,
			parkingSessionId: input.parkingSessionId,
		},
	};
	await enqueueOutbox(input.userId, item);
	kickOperatorSync();

	const tenantName = input.operatorContext.tenant?.name ?? "ParkTru";
	const lotName =
		input.operatorContext.allowedLots.find((l) => l.id === lotId)?.name ??
		"Unknown lot";

	return {
		amount: input.finalAmount,
		customerName: session.customerName,
		customerPhone: session.customerPhone,
		entryAt: session.entryAt,
		exitAt,
		operatorName:
			input.operatorContext.user.name ??
			input.operatorContext.user.email ??
			"Operator",
		parkingLotName: lotName,
		plateNumber: session.displayPlateNumber,
		tenantName,
	};
}

export async function postEntryTimeWithOffline(input: {
	entryAt: string;
	operatorContext: OperatorContext;
	parkingSessionId: string;
	userId: string;
}): Promise<boolean> {
	const idempotencyKey = newIdempotencyKey();
	const lotId =
		input.operatorContext.selectedParkingLotId ??
		input.operatorContext.allowedLots[0]?.id;
	if (!lotId) return false;

	const online = await tryPost(async () =>
		unwrapApiResult(
			await eden.operator["entry-time"].post({
				entryAt: input.entryAt,
				idempotencyKey,
				parkingSessionId: input.parkingSessionId,
			}),
		),
	);

	if (online) {
		return true;
	}

	const lists = (await loadSessionLists(input.userId, lotId)) ?? {
		activeSessions: [],
		recentSessions: [],
	};
	const patch = (s: SessionSnapshot): SessionSnapshot =>
		s.id === input.parkingSessionId ? { ...s, entryAt: input.entryAt } : s;

	await saveSessionLists(input.userId, lotId, {
		activeSessions: lists.activeSessions.map(patch),
		recentSessions: lists.recentSessions.map(patch),
	});

	const item: OutboxItem = {
		attempts: 0,
		createdAt: Date.now(),
		id: newCommandId(),
		idempotencyKey,
		kind: "entry-time",
		payload: {
			entryAt: input.entryAt,
			parkingSessionId: input.parkingSessionId,
		},
	};
	await enqueueOutbox(input.userId, item);
	kickOperatorSync();
	return true;
}

export async function postSelectGateWithOffline(input: {
	operatorContext: OperatorContext;
	parkingGateId: string;
	userId: string;
}): Promise<OperatorContext | null> {
	const idempotencyKey = newIdempotencyKey();
	const online = await tryPost(async () =>
		unwrapApiResult(
			await eden.operator["select-gate"].post({
				idempotencyKey,
				parkingGateId: input.parkingGateId,
			}),
		),
	);
	if (online) {
		await saveOperatorContext(input.userId, online);
		return online;
	}
	const base = await loadOperatorContext(input.userId);
	if (!base) return null;
	const next: OperatorContext = {
		...base,
		selectedParkingGateId: input.parkingGateId,
	};
	await saveOperatorContext(input.userId, next);
	const item: OutboxItem = {
		attempts: 0,
		createdAt: Date.now(),
		id: newCommandId(),
		idempotencyKey,
		kind: "select-gate",
		payload: { parkingGateId: input.parkingGateId },
	};
	await enqueueOutbox(input.userId, item);
	kickOperatorSync();
	return next;
}

export async function postSelectLotWithOffline(input: {
	operatorContext: OperatorContext;
	parkingLotId: string;
	userId: string;
}): Promise<OperatorContext | null> {
	const idempotencyKey = newIdempotencyKey();
	const online = await tryPost(async () =>
		unwrapApiResult(
			await eden.operator["select-lot"].post({
				idempotencyKey,
				parkingLotId: input.parkingLotId,
			}),
		),
	);
	if (online) {
		await saveOperatorContext(input.userId, online);
		return online;
	}
	const base = await loadOperatorContext(input.userId);
	if (!base) return null;
	const next: OperatorContext = {
		...base,
		selectedParkingLotId: input.parkingLotId,
	};
	await saveOperatorContext(input.userId, next);
	const item: OutboxItem = {
		attempts: 0,
		createdAt: Date.now(),
		id: newCommandId(),
		idempotencyKey,
		kind: "select-lot",
		payload: { parkingLotId: input.parkingLotId },
	};
	await enqueueOutbox(input.userId, item);
	kickOperatorSync();
	return next;
}

export async function postBootstrapWithOffline(input: {
	baseRate: number;
	initialLotName: string;
	tenantName: string;
	userId: string;
}): Promise<OperatorContext | null> {
	const idempotencyKey = newIdempotencyKey();
	const online = await tryPost(async () =>
		unwrapApiResult(
			await eden.operator.bootstrap.post({
				baseRate: input.baseRate,
				idempotencyKey,
				initialLotName: input.initialLotName,
				tenantName: input.tenantName,
			}),
		),
	);
	if (online) {
		await saveOperatorContext(input.userId, online);
		return online;
	}
	const item: OutboxItem = {
		attempts: 0,
		createdAt: Date.now(),
		id: newCommandId(),
		idempotencyKey,
		kind: "bootstrap",
		payload: {
			baseRate: input.baseRate,
			initialLotName: input.initialLotName,
			tenantName: input.tenantName,
		},
	};
	await enqueueOutbox(input.userId, item);
	kickOperatorSync();
	return null;
}

export async function postParkingLotWithOffline(input: {
	baseRate?: number;
	name: string;
	userId: string;
}): Promise<OperatorContext | null> {
	const idempotencyKey = newIdempotencyKey();
	const online = await tryPost(async () =>
		unwrapApiResult(
			await eden.operator["parking-lot"].post({
				baseRate: input.baseRate,
				idempotencyKey,
				name: input.name,
			}),
		),
	);
	if (online) {
		await saveOperatorContext(input.userId, online);
		return online;
	}
	const item: OutboxItem = {
		attempts: 0,
		createdAt: Date.now(),
		id: newCommandId(),
		idempotencyKey,
		kind: "parking-lot",
		payload: { baseRate: input.baseRate, name: input.name },
	};
	await enqueueOutbox(input.userId, item);
	kickOperatorSync();
	return null;
}

export async function postParkingGateWithOffline(input: {
	name: string;
	parkingLotId: string;
	userId: string;
}): Promise<OperatorContext | null> {
	const idempotencyKey = newIdempotencyKey();
	const online = await tryPost(async () =>
		unwrapApiResult(
			await eden.operator["parking-gate"].post({
				idempotencyKey,
				name: input.name,
				parkingLotId: input.parkingLotId,
			}),
		),
	);
	if (online) {
		await saveOperatorContext(input.userId, online);
		return online;
	}
	const item: OutboxItem = {
		attempts: 0,
		createdAt: Date.now(),
		id: newCommandId(),
		idempotencyKey,
		kind: "parking-gate",
		payload: { name: input.name, parkingLotId: input.parkingLotId },
	};
	await enqueueOutbox(input.userId, item);
	kickOperatorSync();
	return null;
}

export async function postLotRateWithOffline(input: {
	baseRate: number;
	countryCode: string;
	currencyCode: string;
	operatorContext: OperatorContext;
	parkingLotId: string;
	userId: string;
}): Promise<boolean> {
	const idempotencyKey = newIdempotencyKey();
	const online = await tryPost(async () =>
		unwrapApiResult(
			await eden.operator["lot-rate"].post({
				baseRate: input.baseRate,
				countryCode: input.countryCode,
				currencyCode: input.currencyCode,
				idempotencyKey,
				parkingLotId: input.parkingLotId,
			}),
		),
	);
	if (online) {
		const ctx = await tryPost(async () =>
			unwrapApiResult(await eden.operator.context.get()),
		);
		if (ctx) {
			await saveOperatorContext(input.userId, ctx);
		}
		return true;
	}
	const base = await loadOperatorContext(input.userId);
	if (!base) return false;
	const allowedLots = base.allowedLots.map((lot) =>
		lot.id === input.parkingLotId
			? {
					...lot,
					baseRate: input.baseRate,
					countryCode: input.countryCode,
					currencyCode: input.currencyCode,
				}
			: lot,
	);
	await saveOperatorContext(input.userId, { ...base, allowedLots });
	const item: OutboxItem = {
		attempts: 0,
		createdAt: Date.now(),
		id: newCommandId(),
		idempotencyKey,
		kind: "lot-rate",
		payload: {
			baseRate: input.baseRate,
			countryCode: input.countryCode,
			currencyCode: input.currencyCode,
			parkingLotId: input.parkingLotId,
		},
	};
	await enqueueOutbox(input.userId, item);
	kickOperatorSync();
	return true;
}

export async function postReceiptLinkWithOffline(input: {
	operatorContext: OperatorContext;
	parkingSessionId: string;
	userId: string;
}): Promise<
	| import("@/features/operator-operations/models/operator-operations.types").ReceiptPreview
	| null
> {
	const idempotencyKey = newIdempotencyKey();
	const online = await tryPost(async () =>
		unwrapApiResult(
			await eden.operator.receipt.link.post({
				idempotencyKey,
				parkingSessionId: input.parkingSessionId,
			}),
		),
	);
	if (online) {
		return online;
	}
	return null;
}

export async function mergeLotReportOverlay(
	userId: string,
	parkingLotId: string,
	lists: SessionLists,
): Promise<LotReport> {
	const cached = await loadLotReport(userId, parkingLotId);
	if (cached) {
		return cached;
	}
	const pool = [...lists.activeSessions, ...lists.recentSessions];
	const closed = pool.filter((s) => s.status === "closed");
	let totalRevenue = 0;
	for (const s of closed) {
		if (s.finalAmount != null) {
			totalRevenue += s.finalAmount;
		}
	}
	const plates = new Set(
		pool.map((s) => normalizePlateNumber(s.displayPlateNumber)),
	);
	const phones = new Set(pool.map((s) => s.customerPhone.trim()));
	return {
		cars: [],
		closedSessionCount: closed.length,
		owners: [],
		totalRevenue,
		uniqueCarCount: plates.size,
		uniqueOwnerCount: phones.size,
	};
}
