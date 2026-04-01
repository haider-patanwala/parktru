"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	formatCurrency,
	formatDateTime,
	formatDuration,
	unwrapApiResult,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type { ReceiptPreview } from "@/features/operator-operations/models/operator-operations.types";
import { eden } from "@/server/eden";

interface ReceiptOverlayProps {
	preview: ReceiptPreview;
	sessionId: string;
	onDismiss: () => void;
}

export function ReceiptOverlay({
	preview,
	sessionId,
	onDismiss,
}: ReceiptOverlayProps) {
	const shareReceiptMutation = useMutation({
		mutationFn: async () =>
			unwrapApiResult<ReceiptPreview>(
				await eden.operator.receipt.link.post({
					parkingSessionId: sessionId,
				}),
			),
		onSuccess: async (result) => {
			const shareUrl = `${window.location.origin}${result.sharePath}`;

			if (typeof navigator !== "undefined" && navigator.share) {
				await navigator.share({
					text: `Receipt ${result.receiptNumber} for ${result.plateNumber}`,
					title: `${result.tenantName} receipt`,
					url: shareUrl,
				});
				return;
			}

			if (typeof navigator !== "undefined" && navigator.clipboard) {
				await navigator.clipboard.writeText(shareUrl);
			}
		},
	});

	return (
		<div className="safe-top safe-bottom fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
			{/* Top bar */}
			<div className="flex items-center justify-between px-5 py-4">
				<h2 className="font-bold text-lg">Receipt</h2>
				<Button
					className="rounded-xl text-muted-foreground"
					onClick={onDismiss}
					size="sm"
					variant="ghost"
				>
					Done
				</Button>
			</div>

			{/* Receipt card */}
			<div className="flex-1 overflow-y-auto px-5 pb-6">
				<div className="mx-auto max-w-sm rounded-3xl bg-card p-6 ring-1 ring-border">
					{/* Header */}
					<div className="text-center">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
							{preview.tenantName}
						</p>
						<p className="mt-1 text-muted-foreground text-xs">
							{preview.parkingLotName}
						</p>
					</div>

					<Separator className="my-5" />

					{/* Plate & amount */}
					<div className="text-center">
						<p className="font-bold font-mono text-2xl tracking-wider">
							{preview.plateNumber}
						</p>
						<p className="mt-3 font-bold text-4xl text-primary">
							{formatCurrency(preview.amount)}
						</p>
					</div>

					<Separator className="my-5" />

					{/* Details */}
					<div className="flex flex-col gap-3">
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Customer</span>
							<span className="font-medium">
								{preview.customerName || "Not recorded"}
							</span>
						</div>
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Phone</span>
							<span className="font-medium">
								{preview.customerPhone || "Not recorded"}
							</span>
						</div>
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Entry</span>
							<span className="font-medium">
								{formatDateTime(preview.entryAt)}
							</span>
						</div>
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Exit</span>
							<span className="font-medium">
								{formatDateTime(preview.exitAt)}
							</span>
						</div>
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Duration</span>
							<span className="font-medium">
								{formatDuration(preview.entryAt, preview.exitAt)}
							</span>
						</div>
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Operator</span>
							<span className="font-medium">{preview.operatorName}</span>
						</div>
						{preview.receiptNumber !== "Preview" && (
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Receipt #</span>
								<span className="font-medium font-mono">
									{preview.receiptNumber}
								</span>
							</div>
						)}
					</div>

					<Separator className="my-5" />

					{/* Share link URL if available */}
					{preview.sharePath && (
						<div className="mb-4 rounded-xl bg-secondary px-3 py-2 text-center">
							<p className="break-all font-mono text-muted-foreground text-xs">
								{typeof window !== "undefined" ? window.location.origin : ""}
								{preview.sharePath}
							</p>
						</div>
					)}

					{/* Actions */}
					<div className="flex flex-col gap-2">
						<Button
							className="h-13 rounded-xl font-semibold text-base"
							disabled={shareReceiptMutation.isPending}
							onClick={() => shareReceiptMutation.mutate()}
							type="button"
						>
							{shareReceiptMutation.isPending
								? "Generating link..."
								: "Share receipt"}
						</Button>
						<Button
							className="h-11 rounded-xl"
							onClick={onDismiss}
							type="button"
							variant="ghost"
						>
							Skip
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
