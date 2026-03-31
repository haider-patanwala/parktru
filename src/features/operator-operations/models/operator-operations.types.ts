export interface ParkingLotSummary {
	baseRate: number;
	code: string;
	id: string;
	name: string;
	status: "active" | "inactive";
}

export interface OperatorContext {
	allowedLots: ParkingLotSummary[];
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
