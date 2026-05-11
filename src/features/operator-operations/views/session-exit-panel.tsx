"use client";

import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	computeSuggestedExitAmount,
	roundMoneyAmount,
	type MoneyFormatOptions,
	toMoneyInputValue,
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
		toMoneyInputValue(computeSuggestedExitAmount(session)),
	);
	useEffect(() => {
		setFinalAmount(toMoneyInputValue(computeSuggestedExitAmount(session)));
	}, [session.entryAt, session.baseRateSnapshot, session.rateMode]);
	const closeExitMutation = useMutation({
		mutationFn: async () => {
			const amount = Number(finalAmount);
			if (!Number.isFinite(amount) || amount < 0)
				throw new Error("Final amount must be a valid non-negative number.");
			const roundedAmount = roundMoneyAmount(amount);

			const closed = await postExitWithOffline({
				finalAmount: roundedAmount,
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
			<div className="mb-3">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
					Exit checkout
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Confirm final amount (editable)
				</p>
			</div>

			<div>
				<label
					className="mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wider"
					htmlFor={`final-${session.id}`}
				>
					Final amount
				</label>
				<div className="relative">
					<span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-xs align-sub">
						{moneyFormat.currencyCode}
					</span>
					<Input
						className="h-11 rounded-xl border-border bg-white pr-3 pl-14 text-base dark:bg-input/50"
						id={`final-${session.id}`}
						inputMode="decimal"
						min="0"
						onChange={(e) => {
							const value = e.target.value;
							if (/^\d*(\.\d{0,2})?$/.test(value)) {
								setFinalAmount(value);
							}
						}}
						step="0.01"
						type="number"
						value={finalAmount}
					/>
				</div>
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
