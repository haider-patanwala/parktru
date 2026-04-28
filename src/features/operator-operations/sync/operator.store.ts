import { createStore, del, delMany, get, keys, set } from "idb-keyval";
import type {
	LotReport,
	OperatorContext,
	SessionLists,
} from "@/features/operator-operations/models/operator-operations.types";

const SCHEMA_VERSION = 1;

const customStore = createStore("parktru-operator", "kv");

export interface AuthSnapshot {
	email: string;
	name: string | null;
	updatedAt: string;
	userId: string;
}

function rootKey(userId: string) {
	return `v${SCHEMA_VERSION}:u:${userId}`;
}

function metaKey(userId: string) {
	return `${rootKey(userId)}:meta`;
}

export async function getSchemaVersion(): Promise<number> {
	const v = await get<number>("parktru:schemaVersion", customStore);
	return v ?? 0;
}

export async function setSchemaVersion(version: number) {
	await set("parktru:schemaVersion", version, customStore);
}

export async function clearAllOperatorDataForUser(userId: string) {
	const prefix = `${rootKey(userId)}`;
	const allKeys = await keys<IDBValidKey>(customStore);
	const toDelete = allKeys.filter(
		(k) => typeof k === "string" && k.startsWith(prefix),
	);
	await delMany(toDelete, customStore);
}

export async function saveAuthSnapshot(snapshot: AuthSnapshot) {
	await set(`${rootKey(snapshot.userId)}:auth`, snapshot, customStore);
}

export async function loadAuthSnapshot(
	userId: string,
): Promise<AuthSnapshot | undefined> {
	return get(`${rootKey(userId)}:auth`, customStore);
}

export async function saveOperatorContext(
	userId: string,
	context: OperatorContext,
) {
	const tenantId = context.tenant?.id ?? "none";
	await set(
		metaKey(userId),
		{ tenantId, updatedAt: new Date().toISOString() },
		customStore,
	);
	await set(`${rootKey(userId)}:context`, context, customStore);
}

export async function loadOperatorContext(
	userId: string,
): Promise<OperatorContext | undefined> {
	return get(`${rootKey(userId)}:context`, customStore);
}

export async function saveSessionLists(
	userId: string,
	parkingLotId: string,
	lists: SessionLists,
) {
	await set(
		`${rootKey(userId)}:sessions:${parkingLotId}`,
		lists,
		customStore,
	);
}

export async function loadSessionLists(
	userId: string,
	parkingLotId: string,
): Promise<SessionLists | undefined> {
	return get(`${rootKey(userId)}:sessions:${parkingLotId}`, customStore);
}

export async function saveLotReport(
	userId: string,
	parkingLotId: string,
	report: LotReport,
) {
	await set(
		`${rootKey(userId)}:report:${parkingLotId}`,
		report,
		customStore,
	);
}

export async function loadLotReport(
	userId: string,
	parkingLotId: string,
): Promise<LotReport | undefined> {
	return get(`${rootKey(userId)}:report:${parkingLotId}`, customStore);
}

export interface SessionIdMap {
	[localClientId: string]: string;
}

export async function saveSessionIdMap(userId: string, map: SessionIdMap) {
	await set(`${rootKey(userId)}:sessionMap`, map, customStore);
}

export async function loadSessionIdMap(
	userId: string,
): Promise<SessionIdMap | undefined> {
	return get(`${rootKey(userId)}:sessionMap`, customStore);
}

export async function mergeSessionMapping(
	userId: string,
	localId: string,
	serverId: string,
) {
	const current = (await loadSessionIdMap(userId)) ?? {};
	current[localId] = serverId;
	await saveSessionIdMap(userId, current);
}

export async function resolveSessionIdForServer(
	userId: string,
	sessionId: string,
): Promise<string> {
	const map = await loadSessionIdMap(userId);
	return map?.[sessionId] ?? sessionId;
}

export type OutboxItem = {
	attempts: number;
	createdAt: number;
	id: string;
	idempotencyKey: string;
	kind: string;
	payload: unknown;
};

const OUTBOX_KEY = (userId: string) => `${rootKey(userId)}:outbox`;

export async function loadOutbox(userId: string): Promise<OutboxItem[]> {
	const list = await get<OutboxItem[]>(OUTBOX_KEY(userId), customStore);
	return list ?? [];
}

export async function saveOutbox(userId: string, items: OutboxItem[]) {
	await set(OUTBOX_KEY(userId), items, customStore);
}

export async function enqueueOutbox(userId: string, item: OutboxItem) {
	const q = await loadOutbox(userId);
	q.push(item);
	await saveOutbox(userId, q);
}

export async function replaceOutbox(userId: string, items: OutboxItem[]) {
	await saveOutbox(userId, items);
}

/** Pause sync after repeated auth failures (cleared on successful session fetch). */
export async function setSyncPaused(userId: string, paused: boolean) {
	await set(`${rootKey(userId)}:syncPaused`, paused, customStore);
}

export async function getSyncPaused(userId: string): Promise<boolean> {
	return (await get<boolean>(`${rootKey(userId)}:syncPaused`, customStore)) ?? false;
}

export async function initSchemaIfNeeded() {
	const v = await getSchemaVersion();
	if (v < SCHEMA_VERSION) {
		await setSchemaVersion(SCHEMA_VERSION);
	}
}

const LAST_USER_KEY = "parktru:lastActiveUserId";

export async function saveLastActiveUserId(userId: string) {
	await set(LAST_USER_KEY, userId, customStore);
}

export async function loadLastActiveUserId(): Promise<string | undefined> {
	return get(LAST_USER_KEY, customStore);
}

export async function clearLastActiveUserId() {
	await del(LAST_USER_KEY, customStore);
}
