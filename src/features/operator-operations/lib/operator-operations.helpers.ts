export function normalizePlateNumber(value: string) {
	return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function buildParkingLotCode(name: string) {
	const base = normalizePlateNumber(name).slice(0, 6) || "LOT";
	const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();

	return `${base}-${suffix}`;
}

export function formatCurrency(value: number) {
	return new Intl.NumberFormat("en-IN", {
		currency: "INR",
		maximumFractionDigits: 2,
		minimumFractionDigits: 0,
		style: "currency",
	}).format(value);
}

export function formatDateTime(value: string | Date) {
	const date = value instanceof Date ? value : new Date(value);

	return new Intl.DateTimeFormat("en-IN", {
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
