/** Curated for operator settings — ISO 3166-1 alpha-2 */
export const COUNTRY_OPTIONS: ReadonlyArray<{ code: string; name: string }> = [
	{ code: "US", name: "United States" },
	{ code: "GB", name: "United Kingdom" },
	{ code: "IN", name: "India" },
	{ code: "CA", name: "Canada" },
	{ code: "AU", name: "Australia" },
	{ code: "NZ", name: "New Zealand" },
	{ code: "IE", name: "Ireland" },
	{ code: "AE", name: "United Arab Emirates" },
	{ code: "SG", name: "Singapore" },
	{ code: "MY", name: "Malaysia" },
	{ code: "TH", name: "Thailand" },
	{ code: "ID", name: "Indonesia" },
	{ code: "PH", name: "Philippines" },
	{ code: "VN", name: "Vietnam" },
	{ code: "HK", name: "Hong Kong" },
	{ code: "JP", name: "Japan" },
	{ code: "KR", name: "South Korea" },
	{ code: "CN", name: "China" },
	{ code: "TW", name: "Taiwan" },
	{ code: "DE", name: "Germany" },
	{ code: "FR", name: "France" },
	{ code: "ES", name: "Spain" },
	{ code: "IT", name: "Italy" },
	{ code: "NL", name: "Netherlands" },
	{ code: "BE", name: "Belgium" },
	{ code: "CH", name: "Switzerland" },
	{ code: "AT", name: "Austria" },
	{ code: "SE", name: "Sweden" },
	{ code: "NO", name: "Norway" },
	{ code: "DK", name: "Denmark" },
	{ code: "PL", name: "Poland" },
	{ code: "BR", name: "Brazil" },
	{ code: "MX", name: "Mexico" },
	{ code: "ZA", name: "South Africa" },
	{ code: "NG", name: "Nigeria" },
	{ code: "KE", name: "Kenya" },
	{ code: "EG", name: "Egypt" },
	{ code: "SA", name: "Saudi Arabia" },
	{ code: "TR", name: "Türkiye" },
];

const COUNTRY_NAME_BY_CODE = new Map(
	COUNTRY_OPTIONS.map((c) => [c.code, c.name]),
);

/** Display name for ISO 3166-1 alpha-2, or the raw code if unknown. */
export function countryNameFromCode(code: string): string {
	const u = code.trim().toUpperCase();
	return COUNTRY_NAME_BY_CODE.get(u) ?? code;
}

/**
 * Rough global frequency order (citizenship / nationality picks). Only codes
 * present in {@link COUNTRY_OPTIONS} are used; the rest of that list is appended.
 */
const POPULAR_NATIONALITY_CODES_ORDER: readonly string[] = [
	"US",
	"IN",
	"CN",
	"GB",
	"DE",
	"FR",
	"BR",
	"MX",
	"JP",
	"KR",
	"PH",
	"VN",
	"ID",
	"TH",
	"MY",
	"SG",
	"AE",
	"SA",
	"EG",
	"NG",
	"CA",
	"AU",
	"NZ",
	"IE",
	"HK",
	"TW",
	"IT",
	"ES",
	"NL",
	"ZA",
	"KE",
	"TR",
	"PL",
	"CH",
	"AT",
	"SE",
	"NO",
	"DK",
	"BE",
];

/** Nationality dropdown: popular options first, then remaining countries from settings. */
export function getNationalitySelectOptions(): ReadonlyArray<{
	code: string;
	name: string;
}> {
	const byCode = new Map(COUNTRY_OPTIONS.map((c) => [c.code, c]));
	const seen = new Set<string>();
	const ordered: { code: string; name: string }[] = [];
	for (const code of POPULAR_NATIONALITY_CODES_ORDER) {
		const row = byCode.get(code);
		if (row && !seen.has(code)) {
			ordered.push(row);
			seen.add(code);
		}
	}
	for (const c of COUNTRY_OPTIONS) {
		if (!seen.has(c.code)) {
			ordered.push(c);
		}
	}
	return ordered;
}

/** Default nationality selection for a parking lot’s country (ISO 3166-1 alpha-2). */
export function defaultNationalityCodeForLotCountry(
	lotCountryCode: string | undefined,
): string {
	const u = (lotCountryCode ?? "IN").trim().toUpperCase();
	if (COUNTRY_NAME_BY_CODE.has(u)) return u;
	return "IN";
}

/** Common ISO 4217 codes for parking / retail */
export const CURRENCY_OPTIONS: ReadonlyArray<{ code: string; label: string }> =
	[
		{ code: "USD", label: "US Dollar (USD)" },
		{ code: "EUR", label: "Euro (EUR)" },
		{ code: "GBP", label: "British Pound (GBP)" },
		{ code: "INR", label: "Indian Rupee (INR)" },
		{ code: "AED", label: "UAE Dirham (AED)" },
		{ code: "SAR", label: "Saudi Riyal (SAR)" },
		{ code: "SGD", label: "Singapore Dollar (SGD)" },
		{ code: "MYR", label: "Malaysian Ringgit (MYR)" },
		{ code: "THB", label: "Thai Baht (THB)" },
		{ code: "IDR", label: "Indonesian Rupiah (IDR)" },
		{ code: "PHP", label: "Philippine Peso (PHP)" },
		{ code: "VND", label: "Vietnamese Dong (VND)" },
		{ code: "HKD", label: "Hong Kong Dollar (HKD)" },
		{ code: "JPY", label: "Japanese Yen (JPY)" },
		{ code: "KRW", label: "South Korean Won (KRW)" },
		{ code: "CNY", label: "Chinese Yuan (CNY)" },
		{ code: "TWD", label: "Taiwan Dollar (TWD)" },
		{ code: "AUD", label: "Australian Dollar (AUD)" },
		{ code: "NZD", label: "New Zealand Dollar (NZD)" },
		{ code: "CAD", label: "Canadian Dollar (CAD)" },
		{ code: "CHF", label: "Swiss Franc (CHF)" },
		{ code: "SEK", label: "Swedish Krona (SEK)" },
		{ code: "NOK", label: "Norwegian Krone (NOK)" },
		{ code: "DKK", label: "Danish Krone (DKK)" },
		{ code: "PLN", label: "Polish Złoty (PLN)" },
		{ code: "TRY", label: "Turkish Lira (TRY)" },
		{ code: "BRL", label: "Brazilian Real (BRL)" },
		{ code: "MXN", label: "Mexican Peso (MXN)" },
		{ code: "ZAR", label: "South African Rand (ZAR)" },
		{ code: "NGN", label: "Nigerian Naira (NGN)" },
		{ code: "KES", label: "Kenyan Shilling (KES)" },
		{ code: "EGP", label: "Egyptian Pound (EGP)" },
	];

/** Strip trailing ` (XXX)` from {@link CURRENCY_OPTIONS} labels for single-line UI. */
export function currencyOptionDisplayName(label: string): string {
	return label.replace(/\s*\([A-Z]{3}\)\s*$/, "").trim();
}
