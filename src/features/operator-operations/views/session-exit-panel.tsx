"use client";

import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
	formatDateTime,
	formatDuration,
	type MoneyFormatOptions,
	unwrapApiResult,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	ReceiptPreview,
	SessionSnapshot,
} from "@/features/operator-operations/models/operator-operations.types";
import { eden } from "@/server/eden";

export function SessionExitPanel({
	session,
	baseRate,
	moneyFormat,
	onReceiptReady,
	onCancel,
}: {
	session: SessionSnapshot;
	baseRate: number;
	moneyFormat: MoneyFormatOptions;
	onReceiptReady: (preview: ReceiptPreview, sessionId: string) => void;
	onCancel: () => void;
}) {
	const queryClient = useQueryClient();
	const [finalAmount, setFinalAmount] = useState(
		String(session.overrideAmount ?? baseRate ?? session.baseRateSnapshot ?? 0),
	);
	const [overrideAmount, setOverrideAmount] = useState("");
	const closeExitMutation = useMutation({
		mutationFn: async () => {
			const amount = Number(finalAmount);
			if (!Number.isFinite(amount) || amount < 0)
				throw new Error("Final amount must be a valid non-negative number.");

			const override = overrideAmount ? Number(overrideAmount) : undefined;
			if (
				override !== undefined &&
				(!Number.isFinite(override) || override < 0)
			)
				throw new Error("Override amount must be valid.");

			return unwrapApiResult<{
				amount: number;
				customerName: string;
				customerPhone: string;
				entryAt: string;
				exitAt: string;
				operatorName: string;
				parkingLotName: string;
				plateNumber: string;
				tenantName: string;
			}>(
				await eden.operator.exit.post({
					finalAmount: amount,
					overrideAmount: override,
					parkingSessionId: session.id,
				}),
			);
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

			<div className="grid grid-cols-2 gap-3">
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
				<div>
					<label
						className="mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wider"
						htmlFor={`override-${session.id}`}
					>
						Override
					</label>
					<Input
						className="h-11 rounded-xl border-border bg-white px-3 text-base dark:bg-input/50"
						id={`override-${session.id}`}
						min="0"
						onChange={(e) => setOverrideAmount(e.target.value)}
						placeholder="Optional"
						step="1"
						type="number"
						value={overrideAmount}
					/>
				</div>
			</div>

			<div className="mt-3 flex gap-2">
				<Button
					className="h-12 flex-1 rounded-xl font-semibold text-base"
					disabled={closeExitMutation.isPending}
					onClick={() => closeExitMutation.mutate()}
					type="button"
				>
					{closeExitMutation.isPending ? "Closing..." : "Close exit"}
				</Button>
				<Button
					className="h-12 rounded-xl"
					onClick={onCancel}
					type="button"
					variant="outline"
				>
					Cancel
				</Button>
			</div>
		</div>
	);
}
