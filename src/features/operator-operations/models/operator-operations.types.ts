export interface ParkingLotSummary {
	baseRate: number;
	/** ISO 3166-1 alpha-2 — used for number/date locale */
	countryCode: string;
	/** ISO 4217 */
	currencyCode: string;
	code: string;
	id: string;
	name: string;
	status: "active" | "inactive";
}

export interface ParkingGateSummary {
	code: string;
	id: string;
	name: string;
}

export interface OperatorContext {
	allowedLots: ParkingLotSummary[];
	gatesForSelectedLot: ParkingGateSummary[];
	selectedParkingGateId: string | null;
	selectedParkingLotId: string | null;
	tenant: {
		id: string;
		name: string;
	} | null;
	user: {
		email: string;
		id: string;
		name: string | null;
		role: string | null;
	};
	workspaceReady: boolean;
}

export interface SessionSnapshot {
	baseRateSnapshot: number;
	customerName: string;
	customerPhone: string;
	displayPlateNumber: string;
	entryAt: string;
	exitAt: string | null;
	finalAmount: number | null;
	id: string;
	overrideAmount: number | null;
	parkingGateId: string | null;
	parkingGateName: string | null;
	parkingLotId: string;
	parkingLotName: string;
	status: "active" | "closed";
}

export interface PlateLookupResult {
	activeSession: SessionSnapshot | null;
	customerDefaults: {
		customerName: string;
		customerPhone: string;
	} | null;
	normalizedPlateNumber: string;
	recentMatches: SessionSnapshot[];
}

export interface ReceiptPreview {
	amount: number;
	countryCode: string;
	currencyCode: string;
	customerName: string;
	customerPhone: string;
	entryAt: string;
	exitAt: string;
	generatedAt: string;
	operatorName: string;
	parkingLotName: string;
	plateNumber: string;
	receiptId: string;
	receiptNumber: string;
	sharePath: string;
	tenantName: string;
}

export interface SessionLists {
	activeSessions: SessionSnapshot[];
	recentSessions: SessionSnapshot[];
}

export interface CarReportRow {
	displayPlateNumber: string;
	lastVisitAt: string | null;
	normalizedPlateNumber: string;
	totalRevenue: number;
	vehicleType: string;
	visitCount: number;
}

export interface OwnerReportRow {
	customerName: string;
	customerPhone: string;
	lastVisitAt: string | null;
	totalRevenue: number;
	visitCount: number;
}

export interface LotReport {
	cars: CarReportRow[];
	closedSessionCount: number;
	owners: OwnerReportRow[];
	totalRevenue: number;
	uniqueCarCount: number;
	uniqueOwnerCount: number;
}

export interface ApiSuccess<T> {
	data: T;
	message?: undefined;
	success: true;
}

export interface ApiFailure {
	data: null;
	message: string;
	success: false;
}

export type ApiResult<T> = ApiFailure | ApiSuccess<T>;
