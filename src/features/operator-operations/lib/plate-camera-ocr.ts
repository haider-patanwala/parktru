import type { LoggerMessage, Worker } from "tesseract.js";
import { normalizePlateNumber } from "@/features/operator-operations/lib/operator-operations.helpers";

const OCR_LANGUAGE = "eng+ara";
const ASCII_DIGITS = "0123456789";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const TESSERACT_CORE_PATH = "/tesseract/core";
const TESSERACT_LANG_PATH = "/tesseract/lang-data";
const TESSERACT_WORKER_PATH = "/tesseract/worker.min.js";

let workerPromise: Promise<Worker> | null = null;

export interface PlateOcrProgress {
	progress: number;
	status: string;
}

export interface PlateRecognitionResult {
	normalizedPlateNumber: string;
	rawText: string;
}

export function normalizeCameraPlateText(value: string) {
	const digitsNormalized = value
		.split("")
		.map((character) => {
			const arabicIndicIndex = ARABIC_INDIC_DIGITS.indexOf(character);
			if (arabicIndicIndex !== -1) {
				return ASCII_DIGITS[arabicIndicIndex] ?? character;
			}

			const easternArabicIndicIndex = EASTERN_ARABIC_DIGITS.indexOf(character);
			if (easternArabicIndicIndex !== -1) {
				return ASCII_DIGITS[easternArabicIndicIndex] ?? character;
			}

			return character;
		})
		.join("");

	const compactText = digitsNormalized
		.toUpperCase()
		.replace(/\s+/g, "")
		.replace(/[|]/g, "1")
		.replace(/[Oo]/g, "0");

	return normalizePlateNumber(compactText);
}

async function getWorker(onProgress?: (progress: PlateOcrProgress) => void) {
	if (!workerPromise) {
		const { createWorker, OEM, PSM } = await import("tesseract.js");
		workerPromise = createWorker(
			OCR_LANGUAGE,
			OEM.LSTM_ONLY,
			{
				corePath: TESSERACT_CORE_PATH,
				langPath: TESSERACT_LANG_PATH,
				logger(message: LoggerMessage) {
					onProgress?.({
						progress: message.progress,
						status: message.status,
					});
				},
				workerBlobURL: false,
				workerPath: TESSERACT_WORKER_PATH,
			},
			{
				load_number_dawg: "1",
				load_system_dawg: "0",
			},
		).then(async (worker) => {
			await worker.setParameters({
				preserve_interword_spaces: "0",
				tessedit_char_whitelist:
					"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹",
				tessedit_pageseg_mode: PSM.SINGLE_LINE,
				user_defined_dpi: "150",
			});
			return worker;
		});
	}

	return workerPromise;
}

export async function recognizePlateFromImage(
	image: Blob,
	onProgress?: (progress: PlateOcrProgress) => void,
): Promise<PlateRecognitionResult> {
	const worker = await getWorker(onProgress);
	const result = await worker.recognize(image, {
		rotateAuto: true,
	});
	const rawText = result.data.text.trim();

	return {
		normalizedPlateNumber: normalizeCameraPlateText(rawText),
		rawText,
	};
}

export async function releasePlateOcrWorker() {
	if (!workerPromise) {
		return;
	}

	const activeWorkerPromise = workerPromise;
	workerPromise = null;

	try {
		const worker = await activeWorkerPromise;
		await worker.terminate();
	} catch {
		// Ignore release errors so the next scan can start from a clean worker.
	}
}
