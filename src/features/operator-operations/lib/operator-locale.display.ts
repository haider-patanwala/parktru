/** Regional indicator symbols → flag emoji (ISO 3166-1 alpha-2). */
export function countryCodeToFlagEmoji(countryCode: string): string {
	const code = countryCode.trim().toUpperCase();
	if (!/^[A-Z]{2}$/.test(code)) return "";
	const OFFSET = 127397;
	return String.fromCodePoint(
		...[...code].map((c) => OFFSET + c.charCodeAt(0)),
	);
}

/** Symbol for ISO 4217 code via Intl (e.g. USD → $, INR → ₹). */
export function getCurrencySymbol(currencyCode: string): string {
	const code = currencyCode.trim().toUpperCase();
	if (code.length !== 3) return code;
	try {
		const parts = new Intl.NumberFormat(undefined, {
			currency: code,
			currencyDisplay: "narrowSymbol",
			style: "currency",
		}).formatToParts(0);
		return parts.find((p) => p.type === "currency")?.value ?? code;
	} catch {
		return code;
	}
}
