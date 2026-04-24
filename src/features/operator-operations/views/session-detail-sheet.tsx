"use client";

import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { countryNameFromCode } from "@/features/operator-operations/lib/operator-locale.constants";
import { countryCodeToFlagEmoji } from "@/features/operator-operations/lib/operator-locale.display";
import {
	buildWhatsappUrlForSession,
	formatCurrency,
	formatDateTime,
	formatDuration,
	type MoneyFormatOptions,
	parkingVisitStatusLabel,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	OperatorContext,
	ReceiptPreview,
	SessionSnapshot,
} from "@/features/operator-operations/models/operator-operations.types";
import { postEntryRateWithOffline } from "@/features/operator-operations/sync/operator.actions";
import { SessionExitPanel } from "@/features/operator-operations/views/session-exit-panel";

interface SessionDetailSheetProps {
	baseRate: number;
	moneyFormat: MoneyFormatOptions;
	onOpenChange: (open: boolean) => void;
	onReceiptReady: (preview: ReceiptPreview, sessionId: string) => void;
	open: boolean;
	operatorContext: OperatorContext;
	parkingLotName: string;
	session: SessionSnapshot | null;
	userId: string;
}

export function SessionDetailSheet({
	baseRate,
	moneyFormat,
	onOpenChange,
	onReceiptReady,
	open,
	operatorContext,
	parkingLotName,
	session,
	userId,
}: SessionDetailSheetProps) {
	const queryClient = useQueryClient();
	const [editableAmount, setEditableAmount] = useState("");
	const [activeAmount, setActiveAmount] = useState<number>(0);

	useEffect(() => {
		if (!session || session.status !== "active") return;
		const currentAmount =
			session.overrideAmount ?? session.baseRateSnapshot ?? baseRate;
		setActiveAmount(currentAmount);
		setEditableAmount(String(currentAmount));
	}, [baseRate, session]);

	const shareWhatsapp = () => {
		if (!session) return;
		const url = buildWhatsappUrlForSession(
			session,
			parkingLotName,
			moneyFormat,
		);
		window.open(url, "_blank", "noopener,noreferrer");
	};

	const handleReceipt = (preview: ReceiptPreview, sessionId: string) => {
		onOpenChange(false);
		onReceiptReady(preview, sessionId);
	};

	const updateAmountMutation = useMutation({
		mutationFn: async () => {
			if (!session || session.status !== "active") {
				throw new Error("Only active sessions can be edited.");
			}
			const amount = Number(editableAmount);
			if (!Number.isFinite(amount) || amount < 0) {
				throw new Error("Amount must be a valid non-negative number.");
			}

			const ok = await postEntryRateWithOffline({
				amount,
				parkingLotId: session.parkingLotId,
				parkingSessionId: session.id,
				userId,
			});
			if (!ok) throw new Error("Could not update amount.");
			return amount;
		},
		onError: (error) => {
			toast.danger(
				error instanceof Error ? error.message : "Could not update amount.",
				{ timeout: 2000 },
			);
		},
		onSuccess: (amount) => {
			if (!session) return;
			setActiveAmount(amount);
			queryClient.setQueryData(
				["operator-sessions", session.parkingLotId, userId],
				(
					prev:
						| {
								activeSessions: SessionSnapshot[];
								recentSessions: SessionSnapshot[];
						  }
						| undefined,
				) => {
					if (!prev) return prev;
					const patch = (s: SessionSnapshot): SessionSnapshot =>
						s.id === session.id ? { ...s, baseRateSnapshot: amount } : s;
					return {
						activeSessions: prev.activeSessions.map(patch),
						recentSessions: prev.recentSessions.map(patch),
					};
				},
			);
			toast.success("Amount updated.", { timeout: 1500 });
		},
	});

	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent
				className="z-[60] max-h-[min(92dvh,800px)] gap-0 overflow-y-auto rounded-t-[1.75rem] border-0 bg-white p-0 pt-2 sm:max-w-lg dark:bg-background"
				overlayClassName="z-[60]"
				showCloseButton
				side="bottom"
			>
				{session && (
					<div className="flex flex-col gap-4 px-4 pt-2 pb-6">
						<SheetHeader className="space-y-1 px-0 text-start">
							<SheetTitle className="font-mono text-xl tracking-wide">
								{session.displayPlateNumber}
							</SheetTitle>
							<SheetDescription className="text-start text-muted-foreground text-sm">
								Parking details · {parkingLotName}
							</SheetDescription>
						</SheetHeader>

						<div className="flex flex-wrap items-center gap-2">
							<Badge
								variant={session.status === "active" ? "default" : "secondary"}
							>
								{parkingVisitStatusLabel(session.status)}
							</Badge>
							{session.parkingGateName ? (
								<span className="text-muted-foreground text-xs">
									{session.parkingGateName}
								</span>
							) : null}
						</div>

						<div className="grid grid-cols-2 gap-3 text-sm">
							<div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-border/60 dark:bg-card">
								<p className="text-muted-foreground text-xs">Entry</p>
								<p className="mt-1 font-medium leading-snug">
									{formatDateTime(session.entryAt, moneyFormat.countryCode)}
								</p>
							</div>
							<div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-border/60 dark:bg-card">
								<p className="text-muted-foreground text-xs">Exit</p>
								<p className="mt-1 font-medium leading-snug">
									{session.exitAt
										? formatDateTime(session.exitAt, moneyFormat.countryCode)
										: "—"}
								</p>
							</div>
							<div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-border/60 dark:bg-card">
								<p className="text-muted-foreground text-xs">Duration</p>
								<p className="mt-1 font-medium">
									{session.exitAt
										? formatDuration(session.entryAt, session.exitAt)
										: formatDuration(session.entryAt, new Date())}
								</p>
							</div>
							<div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-border/60 dark:bg-card">
								<p className="text-muted-foreground text-xs">Amount</p>
								<p className="mt-1 font-semibold tabular-nums">
									{session.status === "closed"
										? session.finalAmount != null
											? formatCurrency(session.finalAmount, moneyFormat)
											: "—"
										: formatCurrency(activeAmount, moneyFormat)}
								</p>
								{session.status === "active" ? (
									<>
										<p className="mt-0.5 text-[0.65rem] text-muted-foreground">
											{session.rateMode === "session"
												? "Per-session rate"
												: "Hourly rate"}
										</p>
										<div className="mt-2.5 flex items-end gap-2">
											<div className="min-w-0 flex-1">
												<Input
													className="h-10 rounded-xl bg-secondary px-3"
													min="0"
													onChange={(event) =>
														setEditableAmount(event.target.value)
													}
													step="1"
													type="number"
													value={editableAmount}
												/>
											</div>
											<Button
												className="h-10 rounded-xl px-3.5"
												disabled={updateAmountMutation.isPending}
												onClick={() => updateAmountMutation.mutate()}
												type="button"
												variant="outline"
											>
												{updateAmountMutation.isPending ? "Saving..." : "Save"}
											</Button>
										</div>
									</>
								) : null}
							</div>
						</div>

						<div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-border/60 dark:bg-card">
							<p className="text-muted-foreground text-xs">Customer</p>
							<p className="mt-1 font-medium">{session.customerName || "—"}</p>
							<p className="mt-0.5 font-mono text-muted-foreground text-sm">
								{session.customerPhone || "—"}
							</p>
							{session.nationalityCode ? (
								<p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
									<span className="shrink-0 text-muted-foreground text-xs">
										Nationality
									</span>
									<span aria-hidden className="shrink-0 text-lg leading-none">
										{countryCodeToFlagEmoji(session.nationalityCode)}
									</span>
									<span className="min-w-0 truncate font-medium text-foreground">
										{countryNameFromCode(session.nationalityCode)}
									</span>
									<span className="shrink-0 font-mono text-muted-foreground text-xs tabular-nums">
										{session.nationalityCode}
									</span>
								</p>
							) : null}
						</div>

						<div className="flex flex-col gap-2 sm:flex-row">
							<Button
								className="h-18 flex-1 rounded-xl py-3 font-semibold"
								onClick={shareWhatsapp}
								type="button"
							>
								Share on WhatsApp
							</Button>
						</div>

						{session.status === "active" && (
							<>
								<Separator />
								<SessionExitPanel
									baseRate={baseRate}
									moneyFormat={moneyFormat}
									onReceiptReady={handleReceipt}
									operatorContext={operatorContext}
									session={{ ...session, baseRateSnapshot: activeAmount }}
									userId={userId}
								/>
							</>
						)}
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
