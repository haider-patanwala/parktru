import { Types } from "mongoose";
import {
	buildParkingLotCode,
	buildSharePath,
	normalizePlateNumber,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	OperatorContext,
	PlateLookupResult,
	ReceiptPreview,
	SessionLists,
	SessionSnapshot,
} from "@/features/operator-operations/models/operator-operations.types";
import connectToDatabase from "@/server/mongodb";
import { OperatorProfileModel } from "./operator-profile.schema";
import { type ParkingLotDocument, ParkingLotModel } from "./parking-lot.schema";
import { ParkingLotRateModel } from "./parking-lot-rate.schema";
import { ParkingSessionModel } from "./parking-session.schema";
import { ReceiptModel } from "./receipt.schema";
import { TenantWorkspaceModel } from "./tenant.schema";

interface SessionUserLike {
	email?: string | null;
	id: string;
	name?: string | null;
	role?: string | null;
}

function toIdString(value: unknown) {
	if (value instanceof Types.ObjectId) {
		return value.toString();
	}

	return typeof value === "string" ? value : "";
}

function toObjectId(value: string | Types.ObjectId) {
	return value instanceof Types.ObjectId ? value : new Types.ObjectId(value);
}

function buildReceiptNumber() {
	const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
	const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();

	return `RCT-${stamp}-${suffix}`;
}

async function ensureConnected() {
	await connectToDatabase();
}

async function getLotRateMap(tenantId: string, parkingLotIds: string[]) {
	const rates = await ParkingLotRateModel.find({
		parkingLotId: { $in: parkingLotIds },
		tenantId: toObjectId(tenantId),
	})
		.lean()
		.exec();

	return new Map(
		rates.map((rate) => [toIdString(rate.parkingLotId), rate.baseRate ?? 0]),
	);
}

async function getLotNameMap(tenantId: string) {
	const lots = await ParkingLotModel.find({
		tenantId: toObjectId(tenantId),
	})
		.lean()
		.exec();

	return new Map(lots.map((lot) => [toIdString(lot._id), lot.name]));
}

function mapSessionSnapshot(
	session: {
		_id: Types.ObjectId;
		baseRateSnapshot: number;
		customerName: string;
		customerPhone: string;
		displayPlateNumber: string;
		entryAt: Date;
		exitAt?: Date | null;
		finalAmount?: number | null;
		overrideAmount?: number | null;
		parkingLotId: Types.ObjectId | string;
		status: "active" | "closed";
	},
	lotNameMap: Map<string, string>,
): SessionSnapshot {
	const parkingLotId = toIdString(session.parkingLotId);

	return {
		baseRateSnapshot: session.baseRateSnapshot,
		customerName: session.customerName ?? "",
		customerPhone: session.customerPhone ?? "",
		displayPlateNumber: session.displayPlateNumber,
		entryAt: session.entryAt.toISOString(),
		exitAt: session.exitAt ? session.exitAt.toISOString() : null,
		finalAmount: session.finalAmount ?? null,
		id: toIdString(session._id),
		overrideAmount: session.overrideAmount ?? null,
		parkingLotId,
		parkingLotName: lotNameMap.get(parkingLotId) ?? "Unknown lot",
		status: session.status,
	};
}

function buildReceiptPreview(input: {
	operatorName: string;
	parkingLotName: string;
	receiptId: string;
	receiptNumber: string;
	shareToken: string;
	tenantName: string;
	session: {
		customerName: string;
		customerPhone: string;
		displayPlateNumber: string;
		entryAt: Date;
		exitAt: Date;
		finalAmount: number;
	};
}): ReceiptPreview {
	return {
		amount: input.session.finalAmount,
		customerName: input.session.customerName,
		customerPhone: input.session.customerPhone,
		entryAt: input.session.entryAt.toISOString(),
		exitAt: input.session.exitAt.toISOString(),
		generatedAt: new Date().toISOString(),
		operatorName: input.operatorName,
		parkingLotName: input.parkingLotName,
		plateNumber: input.session.displayPlateNumber,
		receiptId: input.receiptId,
		receiptNumber: input.receiptNumber,
		sharePath: buildSharePath(input.receiptId, input.shareToken),
		tenantName: input.tenantName,
	};
}

export async function getOperatorContextForUser(
	user: SessionUserLike,
): Promise<OperatorContext> {
	await ensureConnected();

	const profile = await OperatorProfileModel.findOne({
		userId: user.id,
	})
		.lean()
		.exec();

	if (!profile) {
		return {
			allowedLots: [],
			selectedParkingLotId: null,
			tenant: null,
			user: {
				email: user.email ?? "",
				id: user.id,
				name: user.name ?? null,
				role: user.role ?? null,
			},
			workspaceReady: false,
		};
	}

	const tenantId = toIdString(profile.tenantId);
	const [tenant, lots] = await Promise.all([
		TenantWorkspaceModel.findById(profile.tenantId).lean().exec(),
		ParkingLotModel.find({
			_id: { $in: profile.allowedParkingLotIds },
			tenantId: profile.tenantId,
		})
			.sort({ name: 1 })
			.lean()
			.exec(),
	]);

	const rateMap = await getLotRateMap(
		tenantId,
		lots.map((lot: ParkingLotDocument & { _id: Types.ObjectId }) =>
			toIdString(lot._id),
		),
	);
	const selectedParkingLotId =
		profile.selectedParkingLotId &&
		lots.some(
			(lot: ParkingLotDocument & { _id: Types.ObjectId }) =>
				toIdString(lot._id) === toIdString(profile.selectedParkingLotId),
		)
			? toIdString(profile.selectedParkingLotId)
			: lots[0]
				? toIdString(lots[0]._id)
				: null;

	return {
		allowedLots: lots.map(
			(lot: ParkingLotDocument & { _id: Types.ObjectId }) => ({
				baseRate: rateMap.get(toIdString(lot._id)) ?? 0,
				code: lot.code,
				id: toIdString(lot._id),
				name: lot.name,
				status: lot.status,
			}),
		),
		selectedParkingLotId,
		tenant: tenant
			? {
					id: toIdString(tenant._id),
					name: tenant.name,
				}
			: null,
		user: {
			email: user.email ?? "",
			id: user.id,
			name: user.name ?? null,
			role: profile.role ?? user.role ?? null,
		},
		workspaceReady: Boolean(tenant && lots.length > 0),
	};
}

export async function bootstrapOperatorWorkspace(input: {
	baseRate: number;
	initialLotName: string;
	tenantName: string;
	user: SessionUserLike;
}) {
	await ensureConnected();

	const existingProfile = await OperatorProfileModel.findOne({
		userId: input.user.id,
	})
		.lean()
		.exec();

	if (existingProfile) {
		return getOperatorContextForUser(input.user);
	}

	const tenant = await TenantWorkspaceModel.create({
		name: input.tenantName.trim(),
		ownerUserId: input.user.id,
	});
	const lot = await ParkingLotModel.create({
		code: buildParkingLotCode(input.initialLotName),
		createdBy: input.user.id,
		name: input.initialLotName.trim(),
		tenantId: tenant._id,
		updatedBy: input.user.id,
	});

	await ParkingLotRateModel.create({
		baseRate: input.baseRate,
		parkingLotId: lot._id,
		tenantId: tenant._id,
		updatedBy: input.user.id,
	});

	await OperatorProfileModel.create({
		allowedParkingLotIds: [lot._id],
		role: "lot-operator",
		selectedParkingLotId: lot._id,
		tenantId: tenant._id,
		userId: input.user.id,
	});

	return getOperatorContextForUser(input.user);
}

export async function setSelectedParkingLotForUser(input: {
	parkingLotId: string;
	userId: string;
}) {
	await ensureConnected();

	const profile = await OperatorProfileModel.findOne({
		userId: input.userId,
	}).exec();

	if (!profile) {
		return null;
	}

	const allowed = profile.allowedParkingLotIds.some(
		(value: Types.ObjectId) => toIdString(value) === input.parkingLotId,
	);

	if (!allowed) {
		return null;
	}

	profile.selectedParkingLotId = toObjectId(input.parkingLotId);
	await profile.save();

	return profile;
}

export async function getSessionsForLot(input: {
	parkingLotId: string;
	tenantId: string;
}): Promise<SessionLists> {
	await ensureConnected();

	const lotNameMap = await getLotNameMap(input.tenantId);
	const [activeSessions, recentSessions] = await Promise.all([
		ParkingSessionModel.find({
			parkingLotId: toObjectId(input.parkingLotId),
			status: "active",
			tenantId: toObjectId(input.tenantId),
		})
			.sort({ entryAt: -1 })
			.limit(8)
			.lean()
			.exec(),
		ParkingSessionModel.find({
			parkingLotId: toObjectId(input.parkingLotId),
			status: "closed",
			tenantId: toObjectId(input.tenantId),
		})
			.sort({ exitAt: -1, updatedAt: -1 })
			.limit(8)
			.lean()
			.exec(),
	]);

	return {
		activeSessions: activeSessions.map((session) =>
			mapSessionSnapshot(session, lotNameMap),
		),
		recentSessions: recentSessions.map((session) =>
			mapSessionSnapshot(session, lotNameMap),
		),
	};
}

export async function lookupPlateForTenant(input: {
	plateNumber: string;
	tenantId: string;
}): Promise<PlateLookupResult> {
	await ensureConnected();

	const normalizedPlateNumber = normalizePlateNumber(input.plateNumber);
	const lotNameMap = await getLotNameMap(input.tenantId);
	const [activeSession, recentMatches] = await Promise.all([
		ParkingSessionModel.findOne({
			normalizedPlateNumber,
			status: "active",
			tenantId: toObjectId(input.tenantId),
		})
			.sort({ entryAt: -1 })
			.lean()
			.exec(),
		ParkingSessionModel.find({
			normalizedPlateNumber,
			tenantId: toObjectId(input.tenantId),
		})
			.sort({ updatedAt: -1 })
			.limit(5)
			.lean()
			.exec(),
	]);

	const mostRecentMatch = recentMatches[0];

	return {
		activeSession: activeSession
			? mapSessionSnapshot(activeSession, lotNameMap)
			: null,
		customerDefaults: mostRecentMatch
			? {
					customerName: mostRecentMatch.customerName ?? "",
					customerPhone: mostRecentMatch.customerPhone ?? "",
				}
			: null,
		normalizedPlateNumber,
		recentMatches: recentMatches.map((session) =>
			mapSessionSnapshot(session, lotNameMap),
		),
	};
}

export async function createParkingEntry(input: {
	customerName: string;
	customerPhone: string;
	displayPlateNumber: string;
	parkingLotId: string;
	tenantId: string;
	userId: string;
	vehicleType?: string;
}) {
	await ensureConnected();

	const normalizedPlateNumber = normalizePlateNumber(input.displayPlateNumber);
	const duplicate = await ParkingSessionModel.findOne({
		normalizedPlateNumber,
		status: "active",
		tenantId: toObjectId(input.tenantId),
	})
		.lean()
		.exec();

	if (duplicate) {
		const lotNameMap = await getLotNameMap(input.tenantId);

		return {
			created: false as const,
			duplicateSession: mapSessionSnapshot(duplicate, lotNameMap),
		};
	}

	const rate = await ParkingLotRateModel.findOne({
		parkingLotId: toObjectId(input.parkingLotId),
		tenantId: toObjectId(input.tenantId),
	})
		.lean()
		.exec();

	await ParkingSessionModel.create({
		baseRateSnapshot: rate?.baseRate ?? 0,
		createdBy: input.userId,
		customerName: input.customerName.trim(),
		customerPhone: input.customerPhone.trim(),
		displayPlateNumber: input.displayPlateNumber.trim(),
		entryAt: new Date(),
		normalizedPlateNumber,
		parkingLotId: toObjectId(input.parkingLotId),
		tenantId: toObjectId(input.tenantId),
		updatedBy: input.userId,
		vehicleType: input.vehicleType?.trim() ?? "",
	});

	return {
		created: true as const,
		duplicateSession: null,
	};
}

export async function updateParkingEntryTime(input: {
	entryAt: string;
	parkingSessionId: string;
	tenantId: string;
	userId: string;
}) {
	await ensureConnected();

	const session = await ParkingSessionModel.findOne({
		_id: toObjectId(input.parkingSessionId),
		tenantId: toObjectId(input.tenantId),
	}).exec();

	if (!session) {
		return null;
	}

	session.entryAt = new Date(input.entryAt);
	session.updatedBy = input.userId;
	await session.save();

	return session;
}

export async function setParkingLotBaseRate(input: {
	baseRate: number;
	parkingLotId: string;
	tenantId: string;
	userId: string;
}) {
	await ensureConnected();

	await ParkingLotRateModel.findOneAndUpdate(
		{
			parkingLotId: toObjectId(input.parkingLotId),
			tenantId: toObjectId(input.tenantId),
		},
		{
			baseRate: input.baseRate,
			parkingLotId: toObjectId(input.parkingLotId),
			tenantId: toObjectId(input.tenantId),
			updatedBy: input.userId,
		},
		{
			new: true,
			upsert: true,
		},
	).exec();

	return true;
}

export async function closeParkingExit(input: {
	finalAmount: number;
	overrideAmount: number | null;
	parkingSessionId: string;
	tenantId: string;
	user: SessionUserLike;
}) {
	await ensureConnected();

	const session = await ParkingSessionModel.findOne({
		_id: toObjectId(input.parkingSessionId),
		status: "active",
		tenantId: toObjectId(input.tenantId),
	}).exec();

	if (!session) {
		return null;
	}

	session.closedBy = input.user.id;
	session.exitAt = new Date();
	session.finalAmount = input.finalAmount;
	session.overrideAmount = input.overrideAmount;
	session.status = "closed";
	session.updatedBy = input.user.id;
	await session.save();

	const [tenant, lot] = await Promise.all([
		TenantWorkspaceModel.findById(session.tenantId).lean().exec(),
		ParkingLotModel.findById(session.parkingLotId).lean().exec(),
	]);

	return {
		amount: session.finalAmount,
		customerName: session.customerName,
		customerPhone: session.customerPhone,
		entryAt: session.entryAt.toISOString(),
		exitAt: session.exitAt.toISOString(),
		operatorName: input.user.name ?? input.user.email ?? "Operator",
		parkingLotName: lot?.name ?? "Unknown lot",
		plateNumber: session.displayPlateNumber,
		tenantName: tenant?.name ?? "ParkTru",
	};
}

export async function generateReceiptLink(input: {
	operatorName: string;
	parkingSessionId: string;
	tenantId: string;
	userId: string;
}): Promise<ReceiptPreview | null> {
	await ensureConnected();

	const session = await ParkingSessionModel.findOne({
		_id: input.parkingSessionId,
		status: "closed",
		tenantId: input.tenantId,
	})
		.lean()
		.exec();

	if (!session || !session.exitAt || !session.finalAmount) {
		return null;
	}

	let receipt = await ReceiptModel.findOne({
		parkingSessionId: input.parkingSessionId,
		tenantId: input.tenantId,
	}).exec();

	if (!receipt) {
		receipt = await ReceiptModel.create({
			createdBy: input.userId,
			generatedAt: new Date(),
			parkingLotId: session.parkingLotId,
			parkingSessionId: session._id,
			receiptNumber: buildReceiptNumber(),
			shareToken: crypto.randomUUID(),
			tenantId: session.tenantId,
		});

		await ParkingSessionModel.updateOne(
			{ _id: session._id },
			{ receiptId: receipt._id },
		).exec();
	}

	const [tenant, lot] = await Promise.all([
		TenantWorkspaceModel.findById(session.tenantId).lean().exec(),
		ParkingLotModel.findById(session.parkingLotId).lean().exec(),
	]);

	return buildReceiptPreview({
		operatorName: input.operatorName,
		parkingLotName: lot?.name ?? "Unknown lot",
		receiptId: toIdString(receipt._id),
		receiptNumber: receipt.receiptNumber,
		session: {
			customerName: session.customerName,
			customerPhone: session.customerPhone,
			displayPlateNumber: session.displayPlateNumber,
			entryAt: session.entryAt,
			exitAt: session.exitAt,
			finalAmount: session.finalAmount,
		},
		shareToken: receipt.shareToken,
		tenantName: tenant?.name ?? "ParkTru",
	});
}

export async function getSharedReceiptPreview(input: {
	receiptId: string;
	shareToken: string;
}): Promise<ReceiptPreview | null> {
	await ensureConnected();

	const receipt = await ReceiptModel.findOne({
		_id: toObjectId(input.receiptId),
		shareToken: input.shareToken,
	})
		.lean()
		.exec();

	if (!receipt) {
		return null;
	}

	const session = await ParkingSessionModel.findById(receipt.parkingSessionId)
		.lean()
		.exec();

	if (!session || !session.exitAt || !session.finalAmount) {
		return null;
	}

	const [tenant, lot] = await Promise.all([
		TenantWorkspaceModel.findById(receipt.tenantId).lean().exec(),
		ParkingLotModel.findById(receipt.parkingLotId).lean().exec(),
	]);

	return buildReceiptPreview({
		operatorName: "ParkTru Operator",
		parkingLotName: lot?.name ?? "Unknown lot",
		receiptId: toIdString(receipt._id),
		receiptNumber: receipt.receiptNumber,
		session: {
			customerName: session.customerName,
			customerPhone: session.customerPhone,
			displayPlateNumber: session.displayPlateNumber,
			entryAt: session.entryAt,
			exitAt: session.exitAt,
			finalAmount: session.finalAmount,
		},
		shareToken: receipt.shareToken,
		tenantName: tenant?.name ?? "ParkTru",
	});
}
