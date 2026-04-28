"use client";

import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
	formatDateTime,
	formatDuration,
	type MoneyFormatOptions,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	OperatorContext,
	ReceiptPreview,
	SessionSnapshot,
} from "@/features/operator-operations/models/operator-operations.types";
import { postExitWithOffline } from "@/features/operator-operations/sync/operator.actions";

export function SessionExitPanel({
	baseRate,
	moneyFormat,
	onReceiptReady,
	operatorContext,
	session,
	userId,
}: {
	baseRate: number;
	moneyFormat: MoneyFormatOptions;
	onReceiptReady: (preview: ReceiptPreview, sessionId: string) => void;
	operatorContext: OperatorContext;
	session: SessionSnapshot;
	userId: string;
}) {
	const queryClient = useQueryClient();
	const [finalAmount, setFinalAmount] = useState(
		String(session.overrideAmount ?? session.baseRateSnapshot ?? baseRate ?? 0),
	);
	useEffect(() => {
		setFinalAmount(
			String(
				session.overrideAmount ?? session.baseRateSnapshot ?? baseRate ?? 0,
			),
		);
	}, [baseRate, session.baseRateSnapshot, session.overrideAmount]);
	const closeExitMutation = useMutation({
		mutationFn: async () => {
			const amount = Number(finalAmount);
			if (!Number.isFinite(amount) || amount < 0)
				throw new Error("Final amount must be a valid non-negative number.");

			const closed = await postExitWithOffline({
				finalAmount: amount,
				operatorContext,
				parkingSessionId: session.id,
				userId,
			});
			if (!closed) {
				throw new Error("No matching parked vehicle was found.");
			}
			return closed;
		},
		onError: (error) => {
			toast.danger(error instanceof Error ? error.message : "Exit failed.", {
				timeout: 2000,
			});
		},
		onSuccess: async (closed) => {
			onReceiptReady(
				{
					amount: closed.amount,
					countryCode: moneyFormat.countryCode,
					currencyCode: moneyFormat.currencyCode,
					customerName: closed.customerName,
					customerPhone: closed.customerPhone,
					entryAt: closed.entryAt,
					exitAt: closed.exitAt,
					generatedAt: new Date().toISOString(),
					operatorName: closed.operatorName,
					parkingLotName: closed.parkingLotName,
					plateNumber: closed.plateNumber,
					receiptId: "",
					receiptNumber: "Preview",
					sharePath: "",
					tenantName: closed.tenantName,
				},
				session.id,
			);
			await queryClient.invalidateQueries({ queryKey: ["operator-sessions"] });
			await queryClient.invalidateQueries({ queryKey: ["operator-reports"] });
		},
	});

	return (
		<div className="rounded-2xl bg-white p-4 ring-1 ring-primary/30 dark:bg-card">
			<div className="mb-3 flex items-center justify-between">
				<div>
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
						Exit checkout
					</p>
					<p className="mt-1 font-bold font-mono text-lg tracking-wider">
						{session.displayPlateNumber}
					</p>
				</div>
				<Badge className="rounded-lg" variant="secondary">
					{formatDuration(session.entryAt, new Date())}
				</Badge>
			</div>

			<div className="mb-3 grid grid-cols-2 gap-2 text-xs">
				<div className="rounded-xl bg-white p-2.5 ring-1 ring-border/60 dark:bg-secondary">
					<p className="text-muted-foreground">Entered</p>
					<p className="mt-0.5 font-medium">
						{formatDateTime(session.entryAt, moneyFormat.countryCode)}
					</p>
				</div>
				<div className="rounded-xl bg-white p-2.5 ring-1 ring-border/60 dark:bg-secondary">
					<p className="text-muted-foreground">Customer</p>
					<p className="mt-0.5 font-medium">
						{session.customerName || session.customerPhone || "N/A"}
					</p>
				</div>
			</div>

			<Separator className="my-3" />

			<div>
				<label
					className="mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wider"
					htmlFor={`final-${session.id}`}
				>
					Final amount
				</label>
				<Input
					className="h-11 rounded-xl border-border bg-white px-3 text-base dark:bg-input/50"
					id={`final-${session.id}`}
					min="0"
					onChange={(e) => setFinalAmount(e.target.value)}
					step="1"
					type="number"
					value={finalAmount}
				/>
			</div>

			<div className="mt-3">
				<Button
					className="h-12 w-full rounded-xl font-semibold text-base"
					disabled={closeExitMutation.isPending}
					onClick={() => closeExitMutation.mutate()}
					type="button"
				>
					{closeExitMutation.isPending ? "Closing..." : "Close exit"}
				</Button>
			</div>
		</div>
	);
}
