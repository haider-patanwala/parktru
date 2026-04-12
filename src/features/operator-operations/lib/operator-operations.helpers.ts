import type { SessionSnapshot } from "@/features/operator-operations/models/operator-operations.types";

export function normalizePlateNumber(value: string) {
	return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function buildParkingLotCode(name: string) {
	const base = normalizePlateNumber(name).slice(0, 6) || "LOT";
	const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();

	return `${base}-${suffix}`;
}

export function buildParkingGateCode(name: string) {
	const base = normalizePlateNumber(name).slice(0, 6) || "GATE";
	const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();

	return `${base}-${suffix}`;
}

export type MoneyFormatOptions = {
	countryCode: string;
	currencyCode: string;
};

export const DEFAULT_MONEY_FORMAT: MoneyFormatOptions = {
	countryCode: "IN",
	currencyCode: "INR",
};

function localeForCountry(countryCode: string) {
	return `en-${countryCode}`;
}

export function moneyFormatFromLot(
	lot: { countryCode: string; currencyCode: string } | null | undefined,
): MoneyFormatOptions {
	if (!lot) return DEFAULT_MONEY_FORMAT;
	return {
		countryCode: lot.countryCode || DEFAULT_MONEY_FORMAT.countryCode,
		currencyCode: lot.currencyCode || DEFAULT_MONEY_FORMAT.currencyCode,
	};
}

export function formatCurrency(
	value: number,
	options?: Partial<MoneyFormatOptions>,
) {
	const { countryCode, currencyCode } = {
		...DEFAULT_MONEY_FORMAT,
		...options,
	};
	return new Intl.NumberFormat(localeForCountry(countryCode), {
		currency: currencyCode,
		maximumFractionDigits: 2,
		minimumFractionDigits: 0,
		style: "currency",
	}).format(value);
}

export function formatDateTime(value: string | Date, countryCode?: string) {
	const date = value instanceof Date ? value : new Date(value);
	const locale = countryCode ? localeForCountry(countryCode) : "en-IN";

	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

export function formatDuration(entryAt: string | Date, exitAt: string | Date) {
	const start = entryAt instanceof Date ? entryAt : new Date(entryAt);
	const end = exitAt instanceof Date ? exitAt : new Date(exitAt);
	const totalMinutes = Math.max(
		0,
		Math.round((end.getTime() - start.getTime()) / 60000),
	);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	if (hours === 0) {
		return `${minutes}m`;
	}

	if (minutes === 0) {
		return `${hours}h`;
	}

	return `${hours}h ${minutes}m`;
}

export function toISOString(value: string | Date): string {
	if (value instanceof Date) return value.toISOString();
	return String(value);
}

export function toDatetimeLocalValue(value: string | Date): string {
	return toISOString(value).slice(0, 16);
}

export function buildSharePath(receiptId: string, shareToken: string) {
	return `/receipts/${receiptId}?token=${encodeURIComponent(shareToken)}`;
}

/** User-facing label for a parking visit (active = still on lot, closed = exited). */
export function parkingVisitStatusLabel(
	status: SessionSnapshot["status"],
): string {
	return status === "active" ? "Parked" : "Exited";
}

/** Opens WhatsApp with a prefilled parking summary; uses customer phone when valid. */
export function buildWhatsappUrlForSession(
	session: SessionSnapshot,
	parkingLotName: string,
	moneyFormat: MoneyFormatOptions,
): string {
	const lines: string[] = [
		"Parked vehicle",
		`Lot: ${parkingLotName}`,
		`Plate: ${session.displayPlateNumber}`,
		`Status: ${parkingVisitStatusLabel(session.status)}`,
		`Customer: ${session.customerName || "—"} (${session.customerPhone || "—"})`,
		`Entry: ${formatDateTime(session.entryAt, moneyFormat.countryCode)}`,
	];
	if (session.exitAt) {
		lines.push(
			`Exit: ${formatDateTime(session.exitAt, moneyFormat.countryCode)}`,
		);
	}
	if (session.status === "closed" && session.finalAmount != null) {
		lines.push(`Paid: ${formatCurrency(session.finalAmount, moneyFormat)}`);
	}
	if (session.parkingGateName) {
		lines.push(`Gate: ${session.parkingGateName}`);
	}
	const text = lines.join("\n");
	const digits = session.customerPhone?.replace(/\D/g, "") ?? "";
	if (digits.length >= 10) {
		return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
	}
	return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function extractErrorMessage(error: unknown) {
	if (error instanceof Error) {
		const edenError = error as Error & {
			status?: number;
			value?: unknown;
		};
		const errorValue = edenError.value;

		if (
			errorValue &&
			typeof errorValue === "object" &&
			"message" in errorValue &&
			typeof errorValue.message === "string" &&
			errorValue.message.length > 0
		) {
			return errorValue.message;
		}

		if (typeof edenError.status === "number" && edenError.message) {
			return `Request failed (${edenError.status}): ${edenError.message}`;
		}

		if (error.message) {
			return error.message;
		}
	}

	return "The request failed.";
}

export function unwrapApiResult<T>(result: {
	data: { success: true; data: T } | { success: false; message: string } | null;
	error: unknown | null;
}) {
	if (result.data?.success) {
		return result.data.data;
	}

	if (result.data && !result.data.success) {
		throw new Error(result.data.message);
	}

	throw new Error(extractErrorMessage(result.error));
}
