import {
	formatCurrency,
	formatDateTime,
	formatDuration,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type { ReceiptPreview } from "@/features/operator-operations/models/operator-operations.types";

export function PublicReceiptPage({
	receipt,
}: {
	receipt: ReceiptPreview | null;
}) {
	if (!receipt) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-linear-to-b from-neutral-50 to-white px-6 py-16 text-neutral-950">
				<section className="w-full max-w-xl rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
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

	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(36,110,98,0.12),_transparent_40%),linear-gradient(to_bottom,_#f7fbfa,_#ffffff)] px-4 py-10 text-neutral-950 sm:px-6">
			<section className="mx-auto flex w-full max-w-2xl flex-col gap-8 rounded-[2rem] border border-neutral-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
				<header className="flex flex-col gap-3 border-neutral-200 border-b pb-6">
					<p className="font-medium text-[0.7rem] text-neutral-500 uppercase tracking-[0.24em]">
						ParkTru receipt
					</p>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<h1 className="font-semibold text-3xl text-neutral-950">
								{receipt.tenantName}
							</h1>
							<p className="mt-1 text-neutral-600">{receipt.parkingLotName}</p>
						</div>
						<div className="rounded-2xl bg-neutral-950 px-4 py-3 text-white">
							<p className="text-white/70 text-xs uppercase tracking-[0.18em]">
								Amount
							</p>
							<p className="mt-1 font-semibold text-2xl">
								{formatCurrency(receipt.amount)}
							</p>
						</div>
					</div>
				</header>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="rounded-3xl bg-neutral-50 p-5">
						<p className="text-neutral-500 text-xs uppercase tracking-[0.16em]">
							Vehicle
						</p>
						<p className="mt-3 font-semibold text-2xl">{receipt.plateNumber}</p>
						<p className="mt-2 text-neutral-600">
							{receipt.customerName || "Customer not recorded"}
						</p>
						<p className="text-neutral-600">{receipt.customerPhone}</p>
					</div>

					<div className="rounded-3xl bg-neutral-50 p-5">
						<p className="text-neutral-500 text-xs uppercase tracking-[0.16em]">
							Stay
						</p>
						<p className="mt-3 font-semibold text-2xl">
							{formatDuration(receipt.entryAt, receipt.exitAt)}
						</p>
						<p className="mt-2 text-neutral-600">
							Entered {formatDateTime(receipt.entryAt)}
						</p>
						<p className="text-neutral-600">
							Exited {formatDateTime(receipt.exitAt)}
						</p>
					</div>
				</div>

				<div className="grid gap-4 rounded-3xl border border-neutral-200 bg-white p-5 sm:grid-cols-2">
					<div>
						<p className="text-neutral-500 text-xs uppercase tracking-[0.16em]">
							Receipt number
						</p>
						<p className="mt-2 font-medium text-lg">{receipt.receiptNumber}</p>
					</div>
					<div>
						<p className="text-neutral-500 text-xs uppercase tracking-[0.16em]">
							Generated
						</p>
						<p className="mt-2 font-medium text-lg">
							{formatDateTime(receipt.generatedAt)}
						</p>
					</div>
					<div>
						<p className="text-neutral-500 text-xs uppercase tracking-[0.16em]">
							Handled by
						</p>
						<p className="mt-2 font-medium text-lg">{receipt.operatorName}</p>
					</div>
					<div>
						<p className="text-neutral-500 text-xs uppercase tracking-[0.16em]">
							Receipt ID
						</p>
						<p className="mt-2 break-all font-medium text-neutral-700 text-sm">
							{receipt.receiptId}
						</p>
					</div>
				</div>
			</section>
		</main>
	);
}
