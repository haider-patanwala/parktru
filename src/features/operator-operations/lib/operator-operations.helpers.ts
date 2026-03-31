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

export function buildSharePath(receiptId: string, shareToken: string) {
	return `/receipts/${receiptId}?token=${encodeURIComponent(shareToken)}`;
}
