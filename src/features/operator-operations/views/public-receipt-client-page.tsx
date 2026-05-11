"use client";

import dynamic from "next/dynamic";
import type { ReceiptPreview } from "@/features/operator-operations/models/operator-operations.types";

const PublicReceiptPage = dynamic(
	() =>
		import("@/features/operator-operations/views/public-receipt-page").then(
			(module) => module.PublicReceiptPage,
		),
	{
		ssr: false,
		loading: () => <ReceiptLayoutSkeleton />,
	},
);

function ReceiptLayoutSkeleton() {
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

export function PublicReceiptClientPage({
	receipt,
}: {
	receipt: ReceiptPreview | null;
}) {
	return <PublicReceiptPage receipt={receipt} />;
}
