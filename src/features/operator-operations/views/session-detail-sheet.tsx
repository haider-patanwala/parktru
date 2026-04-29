"use client";

import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
import {
	buildWhatsappUrlForSession,
	formatCurrency,
	formatDateTime,
	formatDuration,
	toDatetimeLocalValue,
	type MoneyFormatOptions,
	parkingVisitStatusLabel,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	OperatorContext,
	ReceiptPreview,
	SessionSnapshot,
} from "@/features/operator-operations/models/operator-operations.types";
import {
	postEntryRateWithOffline,
	postReceiptLinkWithOffline,
} from "@/features/operator-operations/sync/operator.actions";
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
	onViewCustomerHistory?: (customerPhone: string, customerName?: string) => void;
}

export function SessionDetailSheet({
	baseRate,
	moneyFormat,
	onOpenChange,
	onReceiptReady: _onReceiptReady,
	open,
	operatorContext,
	parkingLotName,
	session,
	userId,
	onViewCustomerHistory,
}: SessionDetailSheetProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [editableAmount, setEditableAmount] = useState("");
	const [activeAmount, setActiveAmount] = useState<number>(0);
	const [editableCustomerName, setEditableCustomerName] = useState("");
	const [editableCustomerPhone, setEditableCustomerPhone] = useState("");
	const [closedReceiptPreview, setClosedReceiptPreview] = useState<ReceiptPreview | null>(null);


	useEffect(() => {
		if (!session || session.status !== "active") return;
		const currentAmount =
			session.overrideAmount ?? session.baseRateSnapshot ?? baseRate;
		setActiveAmount(currentAmount);
		setEditableAmount(String(currentAmount));
	}, [baseRate, session]);

	useEffect(() => {
		if (!session) return;
		setEditableCustomerName(session.customerName ?? "");
		setEditableCustomerPhone(session.customerPhone ?? "");
		setClosedReceiptPreview(null);
	}, [session]);

	const shareWhatsappMutation = useMutation({
		mutationFn: async () => {
			if (!session) return;
			const sessionForShare: SessionSnapshot = {
				...session,
				customerName: editableCustomerName.trim(),
				customerPhone: editableCustomerPhone.trim(),
			};
			const receipt = await postReceiptLinkWithOffline({
				operatorContext,
				parkingSessionId: session.id,
				userId,
			});
			if (!receipt?.sharePath) {
				throw new Error("Public ticket link is unavailable for this session.");
			}
			const ticketUrl = `${window.location.origin}${receipt.sharePath}`;
			const ticketNumber =
				receipt.receiptNumber || `PK-${session.id.slice(-6).toUpperCase()}`;
			return buildWhatsappUrlForSession(
				sessionForShare,
				parkingLotName,
				moneyFormat,
				ticketUrl,
				ticketNumber,
			);
		},
		onError: (error) => {
			toast.danger(
				error instanceof Error ? error.message : "Unable to prepare WhatsApp share.",
				{ timeout: 2200 },
			);
		},
		onSuccess: (url) => {
			if (!url) return;
			window.open(url, "_blank", "noopener,noreferrer");
		},
	});


	const handleReceipt = (preview: ReceiptPreview, _sessionId: string) => {
		setClosedReceiptPreview(preview);
	};

	const shareClosedExitWhatsappMutation = useMutation({
		mutationFn: async () => {
			if (!session || !closedReceiptPreview) return;
			const receipt = await postReceiptLinkWithOffline({
				operatorContext,
				parkingSessionId: session.id,
				userId,
			});
			if (!receipt?.sharePath) {
				throw new Error("Public ticket link is unavailable for this session.");
			}
			const ticketUrl = `${window.location.origin}${receipt.sharePath}`;
			const ticketNumber = receipt.receiptNumber || `PK-${session.id.slice(-6).toUpperCase()}`;
			const closedSession: SessionSnapshot = {
				...session,
				customerName: closedReceiptPreview.customerName,
				customerPhone: closedReceiptPreview.customerPhone,
				displayPlateNumber: closedReceiptPreview.plateNumber,
				exitAt: closedReceiptPreview.exitAt,
				finalAmount: closedReceiptPreview.amount,
				status: "closed",
			};
			return buildWhatsappUrlForSession(
				closedSession,
				parkingLotName,
				moneyFormat,
				ticketUrl,
				ticketNumber,
			);
		},
		onError: (error) => {
			toast.danger(
				error instanceof Error ? error.message : "Unable to prepare WhatsApp share.",
				{ timeout: 2200 },
			);
		},
		onSuccess: (url) => {
			if (!url) return;
			window.open(url, "_blank", "noopener,noreferrer");
		},
	});


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
				className="z-[60] h-[92dvh] max-h-[92dvh] gap-0 overflow-hidden rounded-t-[1.75rem] border-0 bg-white p-0 pt-2 sm:max-w-lg dark:bg-background"
				overlayClassName="z-[60]"
				showCloseButton
				side="bottom"
			>
				{session && (
					<div className="flex h-full flex-col gap-3 px-4 pt-2 pb-4">
						<SheetHeader className="space-y-1 px-0 text-start">
							<div className="flex items-start justify-between gap-3">
								<div>
									<SheetTitle className="font-mono text-xl tracking-wide">
										{session.displayPlateNumber}
									</SheetTitle>
									<SheetDescription className="text-start text-muted-foreground text-xs">
										{parkingLotName}
									</SheetDescription>
								</div>
								<Badge
									variant={session.status === "active" ? "default" : "secondary"}
								>
									{parkingVisitStatusLabel(session.status)}
								</Badge>
							</div>
						</SheetHeader>

						<div className="grid grid-cols-2 gap-2 text-xs">
							<div className="rounded-xl bg-white px-3 py-2 ring-1 ring-border/60 dark:bg-card">
								<p className="text-muted-foreground">Gate</p>
								<p className="mt-1 font-medium leading-snug">
									{session.parkingGateName || "—"}
								</p>
							</div>
							<div className="rounded-xl bg-white px-3 py-2 ring-1 ring-border/60 dark:bg-card">
								<p className="text-muted-foreground">Duration</p>
								<p className="mt-1 font-semibold text-sm">
									{session.exitAt
										? formatDuration(session.entryAt, session.exitAt)
										: formatDuration(session.entryAt, new Date())}
								</p>
							</div>
						</div>

						<div className="rounded-xl bg-white px-3 py-2 ring-1 ring-border/60 dark:bg-card">
							<p className="mb-1 text-muted-foreground text-xs">Entry</p>
							<p className="mt-1 font-medium leading-snug">
								{formatDateTime(session.entryAt, moneyFormat.countryCode)}
							</p>
						</div>

						{session.status === "active" ? (
							<div className="rounded-xl bg-white px-3 py-2 ring-1 ring-border/60 dark:bg-card">
								<div className="mb-1.5 flex items-center justify-between">
									<p className="text-muted-foreground text-xs">Hourly rate</p>
								</div>
								<div className="flex items-end gap-2">
									<div className="relative flex-1">
										<span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-xs align-sub">
											{moneyFormat.currencyCode}
										</span>
										<Input
											className="h-10 rounded-xl bg-secondary pr-3 pl-14"
											inputMode="decimal"
											min="0"
											onChange={(event) => setEditableAmount(event.target.value)}
											step="0.01"
											type="number"
											value={editableAmount}
										/>
									</div>
								</div>
							</div>
						) : null}

						<div className="grid grid-cols-2 gap-2 text-xs">
							<div className="rounded-xl bg-white px-3 py-2 ring-1 ring-border/60 dark:bg-card">
								<p className="text-muted-foreground">Customer name</p>
								<Input
									className="mt-1 h-10 rounded-xl bg-secondary px-3"
									onChange={(event) => setEditableCustomerName(event.target.value)}
									placeholder="Customer name"
									type="text"
									value={editableCustomerName}
								/>
							</div>
							<div className="rounded-xl bg-white px-3 py-2 ring-1 ring-border/60 dark:bg-card">
								<p className="text-muted-foreground">Customer number</p>
								<Input
									className="mt-1 h-10 rounded-xl bg-secondary px-3 font-mono"
									onChange={(event) => setEditableCustomerPhone(event.target.value)}
									placeholder="9876543210"
									type="tel"
									value={editableCustomerPhone}
								/>
							</div>
						</div>

						<div className="mt-auto flex gap-2">
							{onViewCustomerHistory ? (
								<Button
									className="h-12 rounded-xl px-4 font-semibold"
									onClick={() =>
										onViewCustomerHistory(
											editableCustomerPhone.trim(),
											editableCustomerName.trim(),
										)
									}
									type="button"
									variant="outline"
								>
									History
								</Button>
							) : null}
							<Button
								className="h-12 flex-1 rounded-xl font-semibold inline-flex items-center justify-center gap-2"
								disabled={shareWhatsappMutation.isPending}
								onClick={() => shareWhatsappMutation.mutate()}
								type="button"
							>
								<Image
									alt="WhatsApp"
									height={22}
									src="/whatsapp.svg"
									width={22}
								/>
								Share
							</Button>
							{session.status === "active" ? (
								<Button
									className="h-12 rounded-xl px-5 font-semibold"
									disabled={updateAmountMutation.isPending}
									onClick={() => updateAmountMutation.mutate()}
									type="button"
									variant="outline"
								>
									{updateAmountMutation.isPending ? "Saving..." : "Save"}
								</Button>
							) : null}
						</div>

						{session.status === "active" && !closedReceiptPreview && (
							<>
								<Separator />
								<div className="max-h-[34dvh] overflow-y-auto pr-1">
									<SessionExitPanel
										baseRate={baseRate}
										moneyFormat={moneyFormat}
										onReceiptReady={handleReceipt}
										operatorContext={operatorContext}
										session={{ ...session, baseRateSnapshot: activeAmount }}
										userId={userId}
									/>
								</div>
							</>
						)}

						{closedReceiptPreview ? (
							<div className="mt-2 rounded-2xl bg-white p-4 ring-1 ring-primary/25 dark:bg-card">
								<p className="font-semibold text-base">Ticket details</p>
								<div className="mt-3 space-y-1.5 text-sm">
									<p><span className="text-muted-foreground">Plate:</span> <span className="font-medium">{closedReceiptPreview.plateNumber}</span></p>
									<p><span className="text-muted-foreground">Amount:</span> <span className="font-semibold">{formatCurrency(closedReceiptPreview.amount, moneyFormat)}</span></p>
									<p><span className="text-muted-foreground">Entry:</span> {formatDateTime(closedReceiptPreview.entryAt, moneyFormat.countryCode)}</p>
									<p><span className="text-muted-foreground">Exit:</span> {formatDateTime(closedReceiptPreview.exitAt, moneyFormat.countryCode)}</p>
								</div>
								<div className="mt-4 flex flex-col gap-2">
									<Button
										className="h-12 rounded-xl font-semibold inline-flex items-center justify-center gap-2"
										disabled={shareClosedExitWhatsappMutation.isPending}
										onClick={() => shareClosedExitWhatsappMutation.mutate()}
										type="button"
									>
										<Image alt="WhatsApp" height={22} src="/whatsapp.svg" width={22} />
										{shareClosedExitWhatsappMutation.isPending ? "Preparing link..." : "Share on WhatsApp"}
									</Button>
									<Button
										className="h-11 rounded-xl"
										onClick={() => {
											onOpenChange(false);
											router.push("/operator?tab=home");
										}}
										type="button"
										variant="outline"
									>
										Go back to home
									</Button>
								</div>
							</div>
						) : null}
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
