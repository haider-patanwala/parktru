"use client";

import { useEffect, useState } from "react";
import {
	formatCurrency,
	formatDateTime,
	formatDuration,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type { ReceiptPreview } from "@/features/operator-operations/models/operator-operations.types";

const RECEIPT_WIDTH = 794;
const RECEIPT_HEIGHT = 1123;
const RECEIPT_MARGIN = 16;
const MIN_RECEIPT_SCALE = 0.2;

function useReceiptScale() {
	const [scale, setScale] = useState<number | null>(null);

	useEffect(() => {
		function updateScale() {
			const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
			const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
			const availableWidth = Math.max(0, viewportWidth - RECEIPT_MARGIN * 2);
			const availableHeight = Math.max(0, viewportHeight - RECEIPT_MARGIN * 2);
			const nextScale = Math.min(
				availableWidth / RECEIPT_WIDTH,
				availableHeight / RECEIPT_HEIGHT,
				1,
			);

			setScale(Math.max(MIN_RECEIPT_SCALE, nextScale));
		}

		updateScale();
		window.addEventListener("resize", updateScale);
		window.visualViewport?.addEventListener("resize", updateScale);
		window.visualViewport?.addEventListener("scroll", updateScale);

		return () => {
			window.removeEventListener("resize", updateScale);
			window.visualViewport?.removeEventListener("resize", updateScale);
			window.visualViewport?.removeEventListener("scroll", updateScale);
		};
	}, []);

	return scale;
}

export function PublicReceiptPage({
	receipt,
}: {
	receipt: ReceiptPreview | null;
}) {
	const receiptScale = useReceiptScale();

	if (!receipt) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 py-16 text-neutral-950">
				<section className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
					<p className="font-medium text-neutral-500 text-sm uppercase tracking-[0.2em]">
						Receipt unavailable
					</p>
					<h1 className="mt-4 font-semibold text-3xl">
						This receipt link is invalid
					</h1>
					<p className="mt-3 text-neutral-600">
						The shared receipt could not be found or the share token does not
						match.
					</p>
				</section>
			</main>
		);
	}

	if (receiptScale === null) {
		return (
			<main className="fixed inset-0 flex items-center justify-center overflow-hidden bg-neutral-100 p-4 text-neutral-900">
				<section className="flex h-[min(70svh,560px)] w-[min(90vw,396px)] select-none flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
					<div className="h-12 w-12 rounded-xl bg-neutral-900/90 p-2">
						<img alt="ParkTru logo" className="h-full w-full" src="/icon.svg" />
					</div>
					<div className="mt-6 h-3 w-40 rounded-full bg-neutral-200" />
					<div className="mt-3 h-3 w-28 rounded-full bg-neutral-100" />
					<p className="mt-6 font-medium text-neutral-500 text-sm">
						Preparing your receipt…
					</p>
				</section>
			</main>
		);
	}

	const isClosedReceipt = receipt.status !== "active";
	const formattedAmount = formatCurrency(receipt.amount, {
		countryCode: receipt.countryCode,
		currencyCode: receipt.currencyCode,
	});
	const duration = isClosedReceipt
		? formatDuration(receipt.entryAt, receipt.exitAt)
		: "In progress";
	const documentLabel = isClosedReceipt ? "Receipt" : "Parking ticket";
	const documentNumberLabel = isClosedReceipt ? "Receipt no." : "Ticket no.";
	const customerName = receipt.customerName || "Customer not recorded";
	const customerPhone = receipt.customerPhone || "Not provided";

	return (
		<main className="fixed inset-0 flex items-center justify-center overflow-hidden bg-neutral-100 p-4 text-neutral-900">
			<div
				style={{
					height: RECEIPT_HEIGHT * receiptScale,
					width: RECEIPT_WIDTH * receiptScale,
				}}
			>
				<section
					className="h-[1123px] w-[794px] origin-top-left select-none rounded-2xl border border-neutral-200 bg-white p-10 shadow-sm print:h-[1123px] print:w-[794px] print:scale-100 print:rounded-none print:border-0 print:shadow-none"
					style={{ transform: `scale(${receiptScale})` }}
				>
				<header className="flex items-start justify-between gap-8 border-neutral-200 border-b pb-8">
					<div className="flex items-start gap-3">
						<img
							alt="ParkTru logo"
							className="mt-0.5 h-10 w-10 rounded-lg border border-neutral-200 bg-white p-1"
							src="/icon.svg"
						/>
						<div>
							<p className="font-semibold text-2xl tracking-tight">ParkTru</p>
							<p className="text-neutral-600 text-sm">
								{isClosedReceipt
									? "Parking payment receipt"
									: "Active parking ticket"}
							</p>
							<p className="mt-2 text-neutral-700 text-sm">{receipt.tenantName}</p>
							<p className="text-neutral-500 text-sm">{receipt.parkingLotName}</p>
						</div>
					</div>

					<div className="min-w-64 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
						<p className="font-semibold text-neutral-900 text-xs uppercase tracking-[0.18em]">
							{documentLabel} summary
						</p>
						<div className="mt-3 space-y-1.5 text-neutral-700">
							<p className="flex justify-between gap-4">
								<span>{documentNumberLabel}</span>
								<span className="font-medium text-neutral-900">{receipt.receiptNumber}</span>
							</p>
							<p className="flex justify-between gap-4">
								<span>Issued on</span>
								<span>{formatDateTime(receipt.generatedAt, receipt.countryCode)}</span>
							</p>
							<p className="flex justify-between gap-4">
								<span>Status</span>
								<span className="font-medium">{receipt.status === "active" ? "Parked" : "Exited"}</span>
							</p>
						</div>
					</div>
				</header>

				<div className="mt-6 grid grid-cols-2 gap-4">
					<section className="rounded-xl border border-neutral-200 p-4">
						<p className="font-medium text-neutral-500 text-xs uppercase tracking-[0.15em]">Bill to</p>
						<p className="mt-2 font-semibold text-base text-neutral-900">{customerName}</p>
						<p className="text-neutral-600 text-sm">{customerPhone}</p>
					</section>
					<section className="rounded-xl border border-neutral-200 p-4">
						<p className="font-medium text-neutral-500 text-xs uppercase tracking-[0.15em]">Vehicle details</p>
						<p className="mt-2 font-semibold text-base text-neutral-900">{receipt.plateNumber}</p>
						<p className="text-neutral-600 text-sm">Handled by {receipt.operatorName}</p>
					</section>
				</div>

				<section className="mt-6 overflow-hidden rounded-xl border border-neutral-200">
					<table className="w-full table-fixed text-left text-sm">
							<thead className="bg-neutral-50 text-neutral-600 uppercase tracking-[0.1em]">
								<tr>
									<th className="w-[28%] px-4 py-3 font-medium">Description</th>
									<th className="w-[22%] px-4 py-3 font-medium">Entry</th>
									<th className="w-[22%] px-4 py-3 font-medium">Exit</th>
									<th className="w-[16%] px-4 py-3 font-medium">Duration</th>
									<th className="w-[12%] px-4 py-3 text-right font-medium">
										{isClosedReceipt ? "Amount" : "Pending"}
									</th>
								</tr>
							</thead>
							<tbody>
								<tr className="border-neutral-200 border-t">
									<td className="px-4 py-4 font-medium text-neutral-900">
										{isClosedReceipt
											? "Parking charge"
											: "Parking session in progress"}
									</td>
									<td className="px-4 py-4 text-neutral-700">{formatDateTime(receipt.entryAt, receipt.countryCode)}</td>
									<td className="px-4 py-4 text-neutral-700">
										{isClosedReceipt
											? formatDateTime(receipt.exitAt, receipt.countryCode)
											: "Not exited"}
									</td>
									<td className="px-4 py-4 text-neutral-700">{duration}</td>
									<td className="px-4 py-4 text-right font-semibold text-neutral-900">
										{formattedAmount}
									</td>
								</tr>
							</tbody>
						</table>
				</section>

				<footer className="mt-6 flex items-end justify-between gap-3 border-neutral-200 border-t pt-5">
					<div className="text-neutral-500 text-xs">
						<p>{documentLabel} ID: {receipt.receiptId}</p>
						<p className="mt-1">
							{isClosedReceipt
								? "Generated by ParkTru operator system."
								: "This is not a paid receipt. Pending amount may change until exit is processed."}
						</p>
					</div>
					<div className="min-w-56 rounded-xl bg-neutral-900 px-5 py-3 text-right text-white">
						<p className="text-white/70 text-xs uppercase tracking-[0.16em]">
							{isClosedReceipt ? "Total paid" : "Pending amount"}
						</p>
						<p className="mt-1 font-semibold text-2xl">
							{formattedAmount}
						</p>
					</div>
				</footer>
				</section>
			</div>
		</main>
	);
}
