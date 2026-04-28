"use client";

import {
	ArrowRightBigIcon,
	CarTimeIcon,
	DashboardCircleIcon,
	FlashIcon,
	HandCoinsIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	formatCurrency,
	formatDuration,
	moneyFormatFromLot,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	OperatorContext,
	ReceiptPreview,
	SessionLists,
	SessionSnapshot,
} from "@/features/operator-operations/models/operator-operations.types";
import { postSelectLotWithOffline } from "@/features/operator-operations/sync/operator.actions";
import { SessionDetailSheet } from "@/features/operator-operations/views/session-detail-sheet";
import type { TabId } from "./operator-shell";

interface DashboardTabProps {
	onNavigate: (tab: TabId) => void;
	onReceiptReady: (preview: ReceiptPreview, sessionId: string) => void;
	onSelectLot: (lotId: string) => void;
	operatorContext: OperatorContext;
	selectedLotId: string | null;
	sessions: SessionLists | null;
	userId: string;
}

function getGreeting() {
	const hour = new Date().getHours();
	if (hour < 12) return "Good morning";
	if (hour < 17) return "Good afternoon";
	return "Good evening";
}

export function DashboardTab({
	onNavigate,
	onReceiptReady,
	onSelectLot,
	operatorContext,
	selectedLotId,
	sessions,
	userId,
}: DashboardTabProps) {
	const queryClient = useQueryClient();
	const activeLot =
		operatorContext.allowedLots.find((l) => l.id === selectedLotId) ?? null;
	const lotMoneyFormat = moneyFormatFromLot(activeLot);
	const activeCount = sessions?.activeSessions.length ?? 0;
	const recentCount = sessions?.recentSessions.length ?? 0;
	const activeSessions = sessions?.activeSessions ?? [];
	const [sheetSession, setSheetSession] = useState<SessionSnapshot | null>(
		null,
	);

	const selectLotMutation = useMutation({
		mutationFn: async (parkingLotId: string) => {
			const ctx = await postSelectLotWithOffline({
				operatorContext,
				parkingLotId,
				userId,
			});
			if (!ctx) {
				throw new Error("Could not switch lots.");
			}
			return ctx;
		},
		onSuccess: async (context) => {
			onSelectLot(context.selectedParkingLotId ?? "");
			await queryClient.invalidateQueries({ queryKey: ["operator-context"] });
			await queryClient.invalidateQueries({ queryKey: ["operator-sessions"] });
		},
	});

	const firstName = operatorContext.user.name?.split(" ")[0] ?? "Operator";

	return (
		<div className="safe-top flex flex-col gap-5 px-5 pt-20 pb-4">
			{/* Greeting header */}
			<div>
				<p className="text-muted-foreground text-sm">
					{getGreeting()},{" "}
					<span className="font-medium text-foreground">{firstName}</span>
				</p>
				<h1 className="mt-0.5 font-bold text-2xl tracking-tight">
					{operatorContext.tenant?.name ?? "Dashboard"}
				</h1>
			</div>

			{/* Lot selector pill */}
			{operatorContext.allowedLots.length > 1 ? (
				<Select
					disabled={selectLotMutation.isPending}
					onValueChange={(value) => {
						if (!value) return;
						onSelectLot(value);
						selectLotMutation.mutate(value);
					}}
					value={selectedLotId ?? null}
				>
					<SelectTrigger
						className="h-11 w-full rounded-2xl bg-card px-4 ring-1 ring-border"
						size="default"
					>
						<div className="flex items-center gap-2">
							<span className="size-2 rounded-full bg-primary" />
							<SelectValue placeholder="Select parking lot">
								{activeLot?.name}
							</SelectValue>
						</div>
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{operatorContext.allowedLots.map((lot) => (
								<SelectItem key={lot.id} label={lot.name} value={lot.id}>
									{lot.name}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			) : (
				activeLot && (
					<div className="flex items-center gap-2.5 rounded-2xl bg-card px-4 py-3 ring-1 ring-border">
						<span className="size-2 rounded-full bg-primary" />
						<span className="font-medium text-sm">{activeLot.name}</span>
						<span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-primary text-xs">
							{activeLot.code}
						</span>
					</div>
				)
			)}

			{/* Hero stats card */}
			<div className="overflow-hidden rounded-3xl bg-linear-to-br from-primary/15 via-primary/5 to-transparent p-5 ring-1 ring-primary/10">
				<div className="flex items-start justify-between">
					<div>
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
							Vehicles parked
						</p>
						<p className="mt-2 font-bold text-5xl text-foreground tracking-tighter">
							{activeCount}
						</p>
					</div>
					<div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15">
						<HugeiconsIcon
							className="text-primary"
							icon={CarTimeIcon}
							size={24}
							strokeWidth={1.8}
						/>
					</div>
				</div>

				<div className="mt-4 flex gap-3">
					<div className="flex-1 rounded-xl bg-background/60 px-3 py-2">
						<p className="font-bold text-lg">{recentCount}</p>
						<p className="text-muted-foreground text-xs">Exits today</p>
					</div>
					<div className="flex-1 rounded-xl bg-background/60 px-3 py-2">
						<p className="font-bold text-lg">
							{activeLot
								? formatCurrency(activeLot.baseRate, lotMoneyFormat)
								: "--"}
						</p>
						<p className="text-muted-foreground text-xs">Base rate</p>
					</div>
				</div>
			</div>

			{/* Quick actions */}
			<div className="grid grid-cols-2 gap-3">
				<button
					className="group flex flex-col items-start gap-3 rounded-2xl bg-primary p-4 text-left text-primary-foreground transition-transform active:scale-[0.97]"
					onClick={() => onNavigate("gate")}
					type="button"
				>
					<div className="flex size-10 items-center justify-center rounded-xl bg-white/20">
						<HugeiconsIcon icon={FlashIcon} size={20} strokeWidth={2} />
					</div>
					<div>
						<p className="font-semibold text-sm">New entry</p>
						<p className="mt-0.5 text-primary-foreground/70 text-xs">
							Open gate
						</p>
					</div>
				</button>

				<button
					className="group flex flex-col items-start gap-3 rounded-2xl bg-card p-4 text-left ring-1 ring-border transition-transform active:scale-[0.97]"
					onClick={() => onNavigate("sessions")}
					type="button"
				>
					<div className="flex size-10 items-center justify-center rounded-xl bg-secondary">
						<HugeiconsIcon
							className="text-foreground"
							icon={DashboardCircleIcon}
							size={20}
							strokeWidth={2}
						/>
					</div>
					<div>
						<p className="font-semibold text-sm">Parked</p>
						<p className="mt-0.5 text-muted-foreground text-xs">
							{activeCount} on lot
						</p>
					</div>
				</button>
			</div>

			{/* Live activity */}
			{activeSessions.length > 0 && (
				<div>
					<div className="mb-3 flex items-center justify-between">
						<p className="font-semibold text-sm">Live activity</p>
						<button
							className="flex items-center gap-1 text-primary text-xs"
							onClick={() => onNavigate("sessions")}
							type="button"
						>
							View all
							<HugeiconsIcon
								icon={ArrowRightBigIcon}
								size={14}
								strokeWidth={2}
							/>
						</button>
					</div>

					<div className="flex flex-col gap-2">
						{activeSessions.slice(0, 3).map((session) => (
							<button
								className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left ring-1 ring-border transition-transform active:scale-[0.98]"
								key={session.id}
								onClick={() => setSheetSession(session)}
								type="button"
							>
								<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold font-mono text-primary text-xs">
									{session.displayPlateNumber.slice(-4)}
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate font-mono font-semibold text-sm tracking-wider">
										{session.displayPlateNumber}
									</p>
									<p className="truncate text-muted-foreground text-xs">
										{session.customerName || "No name"}
									</p>
									{session.customerPhone ? (
										<p className="truncate text-[0.65rem] text-muted-foreground/80">
											{session.customerPhone}
										</p>
									) : null}
								</div>
								<div className="shrink-0 text-right">
									<p className="font-medium text-primary text-sm">
										{formatDuration(session.entryAt, new Date())}
									</p>
								</div>
							</button>
						))}

						{activeSessions.length > 3 && (
							<button
								className="py-2 text-center text-muted-foreground text-xs"
								onClick={() => onNavigate("sessions")}
								type="button"
							>
								+{activeSessions.length - 3} more vehicles
							</button>
						)}
					</div>
				</div>
			)}

			{/* Empty state when no lot or no sessions */}
			{activeLot && activeSessions.length === 0 && (
				<div className="flex flex-col items-center rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-border">
					<div className="flex size-14 items-center justify-center rounded-2xl bg-secondary">
						<HugeiconsIcon
							className="text-muted-foreground"
							icon={HandCoinsIcon}
							size={28}
							strokeWidth={1.5}
						/>
					</div>
					<p className="mt-4 font-medium">No vehicles parked</p>
					<p className="mt-1 text-muted-foreground text-sm">
						Tap "New entry" to record a parking visit
					</p>
				</div>
			)}

			<SessionDetailSheet
				baseRate={activeLot?.baseRate ?? 0}
				moneyFormat={lotMoneyFormat}
				onOpenChange={(open) => {
					if (!open) setSheetSession(null);
				}}
				onReceiptReady={onReceiptReady}
				open={sheetSession !== null}
				operatorContext={operatorContext}
				parkingLotName={activeLot?.name ?? "Parking lot"}
				session={sheetSession}
				userId={userId}
			/>
		</div>
	);
}
