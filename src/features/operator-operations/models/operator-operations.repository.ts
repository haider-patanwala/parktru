import { Types } from "mongoose";
import {
	buildParkingGateCode,
	buildParkingLotCode,
	buildSharePath,
	normalizePlateNumber,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	LotReport,
	OperatorContext,
	PlateLookupResult,
	ReceiptPreview,
	SessionLists,
	SessionSnapshot,
} from "@/features/operator-operations/models/operator-operations.types";
import connectToDatabase from "@/server/mongodb";
import { OperatorProfileModel } from "./operator-profile.schema";
import {
	type ParkingGateDocument,
	ParkingGateModel,
} from "./parking-gate.schema";
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

function isMongoObjectIdString(value: string) {
	return /^[a-f0-9]{24}$/i.test(value);
}

function buildReceiptNumber() {
	const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
	const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();

	return `RCT-${stamp}-${suffix}`;
}

async function ensureConnected() {
	await connectToDatabase();
}

const DEFAULT_CURRENCY_CODE = "INR";
const DEFAULT_COUNTRY_CODE = "IN";

async function getLotRateDetailsMap(tenantId: string, parkingLotIds: string[]) {
	const rates = await ParkingLotRateModel.find({
		parkingLotId: { $in: parkingLotIds },
		tenantId: toObjectId(tenantId),
	})
		.lean()
		.exec();

	return new Map(
		rates.map((rate) => [
			toIdString(rate.parkingLotId),
			{
				baseRate: rate.baseRate ?? 0,
				countryCode: rate.countryCode ?? DEFAULT_COUNTRY_CODE,
				currencyCode: rate.currencyCode ?? DEFAULT_CURRENCY_CODE,
			},
		]),
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

async function getGateNameMap(tenantId: string) {
	const gates = await ParkingGateModel.find({
		tenantId: toObjectId(tenantId),
	})
		.lean()
		.exec();

	return new Map(gates.map((gate) => [toIdString(gate._id), gate.name]));
}

async function ensureGatesForLot(
	parkingLotId: string,
	tenantId: string,
	userId: string,
): Promise<Array<ParkingGateDocument & { _id: Types.ObjectId }>> {
	const lotOid = toObjectId(parkingLotId);
	const tenantOid = toObjectId(tenantId);
	let gates = await ParkingGateModel.find({
		parkingLotId: lotOid,
		tenantId: tenantOid,
	})
		.sort({ name: 1 })
		.lean()
		.exec();

	if (gates.length > 0) {
		return gates as Array<ParkingGateDocument & { _id: Types.ObjectId }>;
	}

	await ParkingGateModel.create({
		code: buildParkingGateCode("GATE"),
		createdBy: userId,
		name: "Main gate",
		parkingLotId: lotOid,
		status: "active",
		tenantId: tenantOid,
		updatedBy: userId,
	});

	gates = await ParkingGateModel.find({
		parkingLotId: lotOid,
		tenantId: tenantOid,
	})
		.sort({ name: 1 })
		.lean()
		.exec();

	return gates as Array<ParkingGateDocument & { _id: Types.ObjectId }>;
}

async function resolveParkingGateIdForEntry(input: {
	parkingGateId?: string | null;
	parkingLotId: string;
	tenantId: string;
	userId: string;
}): Promise<
	{ gateOid: Types.ObjectId; kind: "ok" } | { kind: "invalid_gate" }
> {
	const gates = await ensureGatesForLot(
		input.parkingLotId,
		input.tenantId,
		input.userId,
	);
	const primary = gates[0]?._id;
	if (!primary) {
		return { kind: "invalid_gate" };
	}

	const requested = input.parkingGateId?.trim();
	if (!requested) {
		return { gateOid: primary, kind: "ok" };
	}

	const found = gates.find((g) => toIdString(g._id) === requested);
	if (!found) {
		return { kind: "invalid_gate" };
	}

	return { gateOid: found._id, kind: "ok" };
}

function mapSessionSnapshot(
	session: {
		_id: Types.ObjectId;
		baseRateSnapshot: number;
		rateMode?: "hourly" | "session";
		customerName: string;
		customerPhone: string;
		displayPlateNumber: string;
		entryAt: Date;
		exitAt?: Date | null;
		finalAmount?: number | null;
		nationalityCode?: string | null;
		overrideAmount?: number | null;
		parkingGateId?: Types.ObjectId | string | null;
		parkingLotId: Types.ObjectId | string;
		status: "active" | "closed";
	},
	lotNameMap: Map<string, string>,
	gateNameMap: Map<string, string>,
): SessionSnapshot {
	const parkingLotId = toIdString(session.parkingLotId);
	const parkingGateId = session.parkingGateId
		? toIdString(session.parkingGateId)
		: null;

	return {
		baseRateSnapshot: session.baseRateSnapshot,
		rateMode: session.rateMode === "session" ? "session" : "hourly",
		customerName: session.customerName ?? "",
		customerPhone: session.customerPhone ?? "",
		nationalityCode: session.nationalityCode?.trim() ?? "",
		displayPlateNumber: session.displayPlateNumber,
		entryAt: session.entryAt.toISOString(),
		exitAt: session.exitAt ? session.exitAt.toISOString() : null,
		finalAmount: session.finalAmount ?? null,
		id: toIdString(session._id),
		overrideAmount: session.overrideAmount ?? null,
		parkingGateId,
		parkingGateName: parkingGateId
			? (gateNameMap.get(parkingGateId) ?? null)
			: null,
		parkingLotId,
		parkingLotName: lotNameMap.get(parkingLotId) ?? "Unknown lot",
		status: session.status,
	};
}

function buildReceiptPreview(input: {
	countryCode: string;
	currencyCode: string;
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
		countryCode: input.countryCode,
		currencyCode: input.currencyCode,
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
			gatesForSelectedLot: [],
			selectedParkingGateId: null,
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

	const rateMap = await getLotRateDetailsMap(
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

	let gatesForSelectedLot: OperatorContext["gatesForSelectedLot"] = [];
	let selectedParkingGateId: string | null = null;

	if (selectedParkingLotId) {
		const gateDocs = await ensureGatesForLot(
			selectedParkingLotId,
			tenantId,
			user.id,
		);
		gatesForSelectedLot = gateDocs.map((g) => ({
			code: g.code,
			id: toIdString(g._id),
			name: g.name,
		}));

		const storedGateId = profile.selectedParkingGateId
			? toIdString(profile.selectedParkingGateId)
			: null;
		const gateValid =
			storedGateId && gateDocs.some((g) => toIdString(g._id) === storedGateId);

		selectedParkingGateId = gateValid
			? storedGateId
			: gateDocs[0]
				? toIdString(gateDocs[0]._id)
				: null;

		if (selectedParkingGateId !== storedGateId) {
			await OperatorProfileModel.updateOne(
				{ userId: user.id },
				{
					$set: {
						selectedParkingGateId: selectedParkingGateId
							? toObjectId(selectedParkingGateId)
							: null,
					},
				},
			).exec();
		}
	} else if (profile.selectedParkingGateId) {
		await OperatorProfileModel.updateOne(
			{ userId: user.id },
			{ $set: { selectedParkingGateId: null } },
		).exec();
	}

	return {
		allowedLots: lots.map(
			(lot: ParkingLotDocument & { _id: Types.ObjectId }) => {
				const details = rateMap.get(toIdString(lot._id));
				return {
					baseRate: details?.baseRate ?? 0,
					code: lot.code,
					countryCode: details?.countryCode ?? DEFAULT_COUNTRY_CODE,
					currencyCode: details?.currencyCode ?? DEFAULT_CURRENCY_CODE,
					id: toIdString(lot._id),
					name: lot.name,
					status: lot.status,
				};
			},
		),
		gatesForSelectedLot,
		selectedParkingGateId,
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

	const gate = await ParkingGateModel.create({
		code: buildParkingGateCode("GATE"),
		createdBy: input.user.id,
		name: "Main gate",
		parkingLotId: lot._id,
		status: "active",
		tenantId: tenant._id,
		updatedBy: input.user.id,
	});

	await OperatorProfileModel.create({
		allowedParkingLotIds: [lot._id],
		role: "lot-operator",
		selectedParkingGateId: gate._id,
		selectedParkingLotId: lot._id,
		tenantId: tenant._id,
		userId: input.user.id,
	});

	return getOperatorContextForUser(input.user);
}

export async function createParkingLotForOperator(input: {
	baseRate?: number;
	name: string;
	user: SessionUserLike;
}) {
	await ensureConnected();

	const profile = await OperatorProfileModel.findOne({
		userId: input.user.id,
	}).exec();

	if (!profile?.tenantId) {
		return null;
	}

	const trimmedName = input.name.trim();
	if (trimmedName.length < 2) {
		return null;
	}

	const tenantId = profile.tenantId;

	let baseRate: number;
	let countryCode = DEFAULT_COUNTRY_CODE;
	let currencyCode = DEFAULT_CURRENCY_CODE;

	const explicitRate =
		input.baseRate !== undefined &&
		Number.isFinite(input.baseRate) &&
		input.baseRate >= 0;

	if (explicitRate) {
		baseRate = input.baseRate as number;
		if (profile.selectedParkingLotId) {
			const siblingRate = await ParkingLotRateModel.findOne({
				parkingLotId: profile.selectedParkingLotId,
				tenantId,
			})
				.lean()
				.exec();
			if (siblingRate) {
				countryCode = siblingRate.countryCode;
				currencyCode = siblingRate.currencyCode;
			}
		}
	} else if (profile.selectedParkingLotId) {
		const siblingRate = await ParkingLotRateModel.findOne({
			parkingLotId: profile.selectedParkingLotId,
			tenantId,
		})
			.lean()
			.exec();
		if (siblingRate) {
			baseRate = siblingRate.baseRate;
			countryCode = siblingRate.countryCode;
			currencyCode = siblingRate.currencyCode;
		} else {
			baseRate = 0;
		}
	} else {
		baseRate = 0;
	}

	const lot = await ParkingLotModel.create({
		code: buildParkingLotCode(trimmedName),
		createdBy: input.user.id,
		name: trimmedName,
		tenantId,
		updatedBy: input.user.id,
	});

	await ParkingLotRateModel.create({
		baseRate,
		countryCode,
		currencyCode,
		parkingLotId: lot._id,
		tenantId,
		updatedBy: input.user.id,
	});

	const gate = await ParkingGateModel.create({
		code: buildParkingGateCode("GATE"),
		createdBy: input.user.id,
		name: "Main gate",
		parkingLotId: lot._id,
		status: "active",
		tenantId,
		updatedBy: input.user.id,
	});

	await OperatorProfileModel.updateOne(
		{ userId: input.user.id },
		{
			$push: { allowedParkingLotIds: lot._id },
			$set: {
				selectedParkingGateId: gate._id,
				selectedParkingLotId: lot._id,
			},
		},
	).exec();

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
	const gateDocs = await ensureGatesForLot(
		input.parkingLotId,
		toIdString(profile.tenantId),
		input.userId,
	);
	profile.selectedParkingGateId = gateDocs[0]?._id ?? null;
	await profile.save();

	return profile;
}

export async function getSessionsForLot(input: {
	parkingLotId: string;
	tenantId: string;
}): Promise<SessionLists> {
	await ensureConnected();

	const [lotNameMap, gateNameMap] = await Promise.all([
		getLotNameMap(input.tenantId),
		getGateNameMap(input.tenantId),
	]);
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
			mapSessionSnapshot(session, lotNameMap, gateNameMap),
		),
		recentSessions: recentSessions.map((session) =>
			mapSessionSnapshot(session, lotNameMap, gateNameMap),
		),
	};
}

export async function getLotReport(input: {
	parkingLotId: string;
	tenantId: string;
}): Promise<LotReport> {
	await ensureConnected();

	const lotOid = toObjectId(input.parkingLotId);
	const tenantOid = toObjectId(input.tenantId);

	const matchStage = {
		$match: {
			parkingLotId: lotOid,
			tenantId: tenantOid,
		},
	};

	type FacetResult = {
		cars: Array<{
			_id: string;
			displayPlateNumber?: string;
			lastVisitAt?: Date | null;
			totalRevenue: number;
			vehicleType?: string;
			visitCount: number;
		}>;
		owners: Array<{
			_id: string;
			customerName?: string;
			lastVisitAt?: Date | null;
			totalRevenue: number;
			visitCount: number;
		}>;
		totals: Array<{
			closedSessionCount: number;
			totalRevenue: number;
			uniqueCarCount: number;
			uniqueOwnerCount: number;
		}>;
	};

	const [raw] = await ParkingSessionModel.aggregate<FacetResult>([
		matchStage,
		{
			$facet: {
				totals: [
					{
						$group: {
							_id: null,
							carIds: { $addToSet: "$normalizedPlateNumber" },
							closedSessionCount: {
								$sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] },
							},
							ownerIds: { $addToSet: "$customerPhone" },
							totalRevenue: {
								$sum: {
									$cond: [
										{
											$and: [
												{ $eq: ["$status", "closed"] },
												{ $ne: ["$finalAmount", null] },
											],
										},
										"$finalAmount",
										0,
									],
								},
							},
						},
					},
					{
						$project: {
							_id: 0,
							closedSessionCount: 1,
							totalRevenue: 1,
							uniqueCarCount: { $size: "$carIds" },
							uniqueOwnerCount: { $size: "$ownerIds" },
						},
					},
				],
				cars: [
					{
						$addFields: {
							sortAt: { $ifNull: ["$exitAt", "$entryAt"] },
						},
					},
					{ $sort: { sortAt: -1 } },
					{
						$group: {
							_id: "$normalizedPlateNumber",
							displayPlateNumber: { $first: "$displayPlateNumber" },
							lastVisitAt: { $first: "$sortAt" },
							totalRevenue: {
								$sum: {
									$cond: [
										{
											$and: [
												{ $eq: ["$status", "closed"] },
												{ $ne: ["$finalAmount", null] },
											],
										},
										"$finalAmount",
										0,
									],
								},
							},
							vehicleType: { $first: "$vehicleType" },
							visitCount: { $sum: 1 },
						},
					},
					{ $sort: { totalRevenue: -1, visitCount: -1 } },
					{ $limit: 200 },
				],
				owners: [
					{
						$addFields: {
							sortAt: { $ifNull: ["$exitAt", "$entryAt"] },
						},
					},
					{ $sort: { sortAt: -1 } },
					{
						$group: {
							_id: "$customerPhone",
							customerName: { $first: "$customerName" },
							lastVisitAt: { $first: "$sortAt" },
							totalRevenue: {
								$sum: {
									$cond: [
										{
											$and: [
												{ $eq: ["$status", "closed"] },
												{ $ne: ["$finalAmount", null] },
											],
										},
										"$finalAmount",
										0,
									],
								},
							},
							visitCount: { $sum: 1 },
						},
					},
					{ $sort: { totalRevenue: -1, visitCount: -1 } },
					{ $limit: 200 },
				],
			},
		},
	]).exec();

	const totals = raw?.totals[0] ?? {
		closedSessionCount: 0,
		totalRevenue: 0,
		uniqueCarCount: 0,
		uniqueOwnerCount: 0,
	};

	const cars = (raw?.cars ?? []).map((row) => ({
		displayPlateNumber: row.displayPlateNumber ?? row._id,
		lastVisitAt: row.lastVisitAt
			? new Date(row.lastVisitAt).toISOString()
			: null,
		normalizedPlateNumber: row._id,
		totalRevenue: row.totalRevenue,
		vehicleType: row.vehicleType ?? "",
		visitCount: row.visitCount,
	}));

	const owners = (raw?.owners ?? []).map((row) => ({
		customerName: row.customerName ?? "",
		customerPhone: row._id,
		lastVisitAt: row.lastVisitAt
			? new Date(row.lastVisitAt).toISOString()
			: null,
		totalRevenue: row.totalRevenue,
		visitCount: row.visitCount,
	}));

	return {
		cars,
		closedSessionCount: totals.closedSessionCount,
		owners,
		totalRevenue: totals.totalRevenue,
		uniqueCarCount: totals.uniqueCarCount,
		uniqueOwnerCount: totals.uniqueOwnerCount,
	};
}

export async function getReportSessionsForCar(input: {
	normalizedPlateNumber: string;
	parkingLotId: string;
	tenantId: string;
}): Promise<SessionSnapshot[]> {
	await ensureConnected();

	const [lotNameMap, gateNameMap] = await Promise.all([
		getLotNameMap(input.tenantId),
		getGateNameMap(input.tenantId),
	]);
	const sessions = await ParkingSessionModel.find({
		normalizedPlateNumber: input.normalizedPlateNumber,
		parkingLotId: toObjectId(input.parkingLotId),
		tenantId: toObjectId(input.tenantId),
	})
		.sort({ entryAt: -1 })
		.limit(100)
		.lean()
		.exec();

	return sessions.map((session) =>
		mapSessionSnapshot(session, lotNameMap, gateNameMap),
	);
}

export async function getReportSessionsForOwner(input: {
	customerPhone: string;
	parkingLotId: string;
	tenantId: string;
}): Promise<SessionSnapshot[]> {
	await ensureConnected();

	const [lotNameMap, gateNameMap] = await Promise.all([
		getLotNameMap(input.tenantId),
		getGateNameMap(input.tenantId),
	]);
	const sessions = await ParkingSessionModel.find({
		customerPhone: input.customerPhone.trim(),
		parkingLotId: toObjectId(input.parkingLotId),
		tenantId: toObjectId(input.tenantId),
	})
		.sort({ entryAt: -1 })
		.limit(100)
		.lean()
		.exec();

	return sessions.map((session) =>
		mapSessionSnapshot(session, lotNameMap, gateNameMap),
	);
}

export async function lookupPlateForTenant(input: {
	plateNumber: string;
	tenantId: string;
}): Promise<PlateLookupResult> {
	await ensureConnected();

	const normalizedPlateNumber = normalizePlateNumber(input.plateNumber);
	const [lotNameMap, gateNameMap] = await Promise.all([
		getLotNameMap(input.tenantId),
		getGateNameMap(input.tenantId),
	]);
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
			? mapSessionSnapshot(activeSession, lotNameMap, gateNameMap)
			: null,
		customerDefaults: mostRecentMatch
			? {
					customerName: mostRecentMatch.customerName ?? "",
					customerPhone: mostRecentMatch.customerPhone ?? "",
				}
			: null,
		normalizedPlateNumber,
		recentMatches: recentMatches.map((session) =>
			mapSessionSnapshot(session, lotNameMap, gateNameMap),
		),
	};
}

export async function createParkingEntry(input: {
	clientMutationId?: string | null;
	customerName: string;
	customerPhone: string;
	displayPlateNumber: string;
	entryAt?: string;
	nationalityCode?: string;
	parkingGateId?: string | null;
	parkingLotId: string;
	rateAmount?: number;
	rateMode?: "hourly" | "session";
	tenantId: string;
	userId: string;
	vehicleType?: string;
}): Promise<
	| { created: false; duplicateSession: null; invalidGate: true }
	| { created: false; duplicateSession: SessionSnapshot }
	| { created: true; duplicateSession: null; session: SessionSnapshot }
> {
	await ensureConnected();

	const trimmedClientId = input.clientMutationId?.trim();
	if (trimmedClientId) {
		const idempotent = await ParkingSessionModel.findOne({
			clientMutationId: trimmedClientId,
			tenantId: toObjectId(input.tenantId),
		})
			.lean()
			.exec();
		if (idempotent) {
			const [lotNameMap, gateNameMap] = await Promise.all([
				getLotNameMap(input.tenantId),
				getGateNameMap(input.tenantId),
			]);
			return {
				created: true,
				duplicateSession: null,
				session: mapSessionSnapshot(idempotent, lotNameMap, gateNameMap),
			};
		}
	}

	const gateResolution = await resolveParkingGateIdForEntry({
		parkingGateId: input.parkingGateId,
		parkingLotId: input.parkingLotId,
		tenantId: input.tenantId,
		userId: input.userId,
	});

	if (gateResolution.kind === "invalid_gate") {
		return {
			created: false,
			duplicateSession: null,
			invalidGate: true,
		};
	}

	const normalizedPlateNumber = normalizePlateNumber(input.displayPlateNumber);
	const duplicate = await ParkingSessionModel.findOne({
		normalizedPlateNumber,
		status: "active",
		tenantId: toObjectId(input.tenantId),
	})
		.lean()
		.exec();

	if (duplicate) {
		const [lotNameMap, gateNameMap] = await Promise.all([
			getLotNameMap(input.tenantId),
			getGateNameMap(input.tenantId),
		]);

		return {
			created: false as const,
			duplicateSession: mapSessionSnapshot(duplicate, lotNameMap, gateNameMap),
		};
	}

	const rate = await ParkingLotRateModel.findOne({
		parkingLotId: toObjectId(input.parkingLotId),
		tenantId: toObjectId(input.tenantId),
	})
		.lean()
		.exec();
	const resolvedRateAmount =
		typeof input.rateAmount === "number" &&
		Number.isFinite(input.rateAmount) &&
		input.rateAmount >= 0
			? input.rateAmount
			: (rate?.baseRate ?? 0);
	const resolvedRateMode = input.rateMode === "session" ? "session" : "hourly";
	const parsedEntryAt = input.entryAt ? new Date(input.entryAt) : new Date();
	const effectiveEntryAt = Number.isNaN(parsedEntryAt.getTime())
		? new Date()
		: parsedEntryAt;

	const created = await ParkingSessionModel.create({
		baseRateSnapshot: resolvedRateAmount,
		clientMutationId: trimmedClientId || null,
		createdBy: input.userId,
		customerName: input.customerName.trim(),
		customerPhone: input.customerPhone.trim(),
		displayPlateNumber: input.displayPlateNumber.trim(),
		entryAt: effectiveEntryAt,
		nationalityCode: input.nationalityCode?.trim() ?? "",
		normalizedPlateNumber,
		parkingGateId: gateResolution.gateOid,
		parkingLotId: toObjectId(input.parkingLotId),
		rateMode: resolvedRateMode,
		tenantId: toObjectId(input.tenantId),
		updatedBy: input.userId,
		vehicleType: input.vehicleType?.trim() ?? "",
	});

	const [lotNameMap, gateNameMap] = await Promise.all([
		getLotNameMap(input.tenantId),
		getGateNameMap(input.tenantId),
	]);

	return {
		created: true as const,
		duplicateSession: null,
		session: mapSessionSnapshot(created, lotNameMap, gateNameMap),
	};
}

export async function updateParkingEntryTime(input: {
	entryAt: string;
	parkingSessionId: string;
	tenantId: string;
	userId: string;
}) {
	await ensureConnected();

	const session = await findParkingSessionScoped({
		parkingSessionId: input.parkingSessionId,
		tenantId: input.tenantId,
	});

	if (!session) {
		return null;
	}

	session.entryAt = new Date(input.entryAt);
	session.updatedBy = input.userId;
	await session.save();

	return session;
}

export async function updateParkingEntryRate(input: {
	amount: number;
	parkingSessionId: string;
	tenantId: string;
	userId: string;
}) {
	await ensureConnected();

	const session = await findParkingSessionScoped({
		parkingSessionId: input.parkingSessionId,
		status: "active",
		tenantId: input.tenantId,
	});

	if (!session) {
		return null;
	}

	session.baseRateSnapshot = input.amount;
	session.updatedBy = input.userId;
	await session.save();

	return session;
}

export async function setParkingLotBaseRate(input: {
	baseRate: number;
	countryCode?: string;
	currencyCode?: string;
	parkingLotId: string;
	tenantId: string;
	userId: string;
}) {
	await ensureConnected();

	const existing = await ParkingLotRateModel.findOne({
		parkingLotId: toObjectId(input.parkingLotId),
		tenantId: toObjectId(input.tenantId),
	})
		.lean()
		.exec();

	const currencyCode =
		input.currencyCode ?? existing?.currencyCode ?? DEFAULT_CURRENCY_CODE;
	const countryCode =
		input.countryCode ?? existing?.countryCode ?? DEFAULT_COUNTRY_CODE;

	await ParkingLotRateModel.findOneAndUpdate(
		{
			parkingLotId: toObjectId(input.parkingLotId),
			tenantId: toObjectId(input.tenantId),
		},
		{
			baseRate: input.baseRate,
			countryCode,
			currencyCode,
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

export async function createParkingGateForLot(input: {
	name: string;
	parkingLotId: string;
	tenantId: string;
	userId: string;
}) {
	await ensureConnected();

	const gate = await ParkingGateModel.create({
		code: buildParkingGateCode(input.name),
		createdBy: input.userId,
		name: input.name.trim(),
		parkingLotId: toObjectId(input.parkingLotId),
		status: "active",
		tenantId: toObjectId(input.tenantId),
		updatedBy: input.userId,
	});

	return {
		code: gate.code,
		id: toIdString(gate._id),
		name: gate.name,
	};
}

export async function setSelectedParkingGateForUser(input: {
	parkingGateId: string;
	userId: string;
}) {
	await ensureConnected();

	const profile = await OperatorProfileModel.findOne({
		userId: input.userId,
	}).exec();

	if (!profile) {
		return null;
	}

	const gate = await ParkingGateModel.findOne({
		_id: toObjectId(input.parkingGateId),
		tenantId: profile.tenantId,
	})
		.lean()
		.exec();

	if (!gate) {
		return null;
	}

	const allowedLot = profile.allowedParkingLotIds.some(
		(id: Types.ObjectId) => toIdString(id) === toIdString(gate.parkingLotId),
	);

	if (!allowedLot) {
		return null;
	}

	if (
		!profile.selectedParkingLotId ||
		toIdString(profile.selectedParkingLotId) !== toIdString(gate.parkingLotId)
	) {
		return null;
	}

	profile.selectedParkingGateId = gate._id as Types.ObjectId;
	await profile.save();

	return profile;
}

async function findParkingSessionScoped(input: {
	parkingSessionId: string;
	tenantId: string;
	status?: "active" | "closed";
}) {
	const tenantOid = toObjectId(input.tenantId);
	if (isMongoObjectIdString(input.parkingSessionId)) {
		const q: Record<string, unknown> = {
			_id: toObjectId(input.parkingSessionId),
			tenantId: tenantOid,
		};
		if (input.status) {
			q.status = input.status;
		}
		return ParkingSessionModel.findOne(q).exec();
	}
	const q: Record<string, unknown> = {
		clientMutationId: input.parkingSessionId.trim(),
		tenantId: tenantOid,
	};
	if (input.status) {
		q.status = input.status;
	}
	return ParkingSessionModel.findOne(q).exec();
}

export async function closeParkingExit(input: {
	finalAmount: number;
	overrideAmount: number | null;
	parkingSessionId: string;
	tenantId: string;
	user: SessionUserLike;
}) {
	await ensureConnected();

	const session = await findParkingSessionScoped({
		parkingSessionId: input.parkingSessionId,
		status: "active",
		tenantId: input.tenantId,
	});

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

	const sessionDoc = await findParkingSessionScoped({
		parkingSessionId: input.parkingSessionId,
		status: "closed",
		tenantId: input.tenantId,
	});

	if (!sessionDoc || !sessionDoc.exitAt || !sessionDoc.finalAmount) {
		return null;
	}

	const session = sessionDoc.toObject();

	let receipt = await ReceiptModel.findOne({
		parkingSessionId: session._id,
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

	const [tenant, lot, rate] = await Promise.all([
		TenantWorkspaceModel.findById(session.tenantId).lean().exec(),
		ParkingLotModel.findById(session.parkingLotId).lean().exec(),
		ParkingLotRateModel.findOne({
			parkingLotId: session.parkingLotId,
			tenantId: session.tenantId,
		})
			.lean()
			.exec(),
	]);

	return buildReceiptPreview({
		countryCode: rate?.countryCode ?? DEFAULT_COUNTRY_CODE,
		currencyCode: rate?.currencyCode ?? DEFAULT_CURRENCY_CODE,
		operatorName: input.operatorName,
		parkingLotName: lot?.name ?? "Unknown lot",
		receiptId: toIdString(receipt._id),
		receiptNumber: receipt.receiptNumber,
		session: {
			customerName: session.customerName,
			customerPhone: session.customerPhone,
			displayPlateNumber: session.displayPlateNumber,
			entryAt: session.entryAt,
			exitAt: session.exitAt as Date,
			finalAmount: session.finalAmount as number,
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

	const [tenant, lot, rate] = await Promise.all([
		TenantWorkspaceModel.findById(receipt.tenantId).lean().exec(),
		ParkingLotModel.findById(receipt.parkingLotId).lean().exec(),
		ParkingLotRateModel.findOne({
			parkingLotId: receipt.parkingLotId,
			tenantId: receipt.tenantId,
		})
			.lean()
			.exec(),
	]);

	return buildReceiptPreview({
		countryCode: rate?.countryCode ?? DEFAULT_COUNTRY_CODE,
		currencyCode: rate?.currencyCode ?? DEFAULT_CURRENCY_CODE,
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
