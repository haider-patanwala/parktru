"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	formatCurrency,
	formatDateTime,
	formatDuration,
	type MoneyFormatOptions,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	ReceiptPreview,
	SessionLists,
	SessionSnapshot,
} from "@/features/operator-operations/models/operator-operations.types";
import { SessionDetailSheet } from "@/features/operator-operations/views/session-detail-sheet";
import { cn } from "@/lib/utils";

interface SessionsTabProps {
	sessions: SessionLists | null;
	isLoading: boolean;
	onSelectSession: () => void;
	baseRate: number;
	moneyFormat: MoneyFormatOptions;
	parkingLotName: string;
	onReceiptReady: (preview: ReceiptPreview, sessionId: string) => void;
}

type SessionFilter = "active" | "recent";

function SessionRow({
	session,
	onOpen,
	isHighlighted,
	moneyFormat,
}: {
	session: SessionSnapshot;
	onOpen: (session: SessionSnapshot) => void;
	isHighlighted: boolean;
	moneyFormat: MoneyFormatOptions;
}) {
	const isActive = session.status === "active";

	return (
		<button
			className={cn(
				"flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left ring-1 ring-border transition-transform active:scale-[0.98]",
				isHighlighted && "ring-primary/40",
			)}
			onClick={() => onOpen(session)}
			type="button"
		>
			{/* Status indicator */}
			<div
				className={cn(
					"flex size-10 shrink-0 items-center justify-center rounded-xl font-bold font-mono text-xs",
					isActive
						? "bg-primary/15 text-primary"
						: "bg-secondary text-muted-foreground",
				)}
			>
				{session.displayPlateNumber.slice(-4)}
			</div>

			{/* Details */}
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<p className="truncate font-mono font-semibold text-sm tracking-wider">
						{session.displayPlateNumber}
					</p>
					<Badge
						className="shrink-0 rounded-md text-[0.6rem]"
						variant={isActive ? "default" : "outline"}
					>
						{session.status}
					</Badge>
				</div>
				<div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground text-xs">
					<span className="truncate">{session.customerName || "No name"}</span>
					<span className="shrink-0">
						{session.customerPhone || "No phone"}
					</span>
					{session.parkingGateName ? (
						<span className="shrink-0 text-[0.65rem] opacity-80">
							{session.parkingGateName}
						</span>
					) : null}
				</div>
			</div>

			{/* Time / Amount */}
			<div className="shrink-0 text-right">
				{isActive ? (
					<>
						<p className="font-medium text-primary text-sm">
							{formatDuration(session.entryAt, new Date())}
						</p>
						<p className="text-muted-foreground text-xs">
							{formatDateTime(session.entryAt, moneyFormat.countryCode)
								.split(",")[1]
								?.trim() ??
								formatDateTime(session.entryAt, moneyFormat.countryCode)}
						</p>
					</>
				) : (
					<>
						<p className="font-semibold text-sm">
							{session.finalAmount != null
								? formatCurrency(session.finalAmount, moneyFormat)
								: "--"}
						</p>
						<p className="text-muted-foreground text-xs">
							{session.exitAt
								? formatDuration(session.entryAt, session.exitAt)
								: "--"}
						</p>
					</>
				)}
			</div>
		</button>
	);
}

export function SessionsTab({
	sessions,
	isLoading,
	onSelectSession,
	baseRate,
	moneyFormat,
	parkingLotName,
	onReceiptReady,
}: SessionsTabProps) {
	const [filter, setFilter] = useState<SessionFilter>("active");
	const [sheetSession, setSheetSession] = useState<SessionSnapshot | null>(
		null,
	);

	const activeSessions = sessions?.activeSessions ?? [];
	const recentSessions = sessions?.recentSessions ?? [];
	const displayedSessions =
		filter === "active" ? activeSessions : recentSessions;

	return (
		<div className="safe-top flex flex-col gap-4 px-5 pt-6 pb-4">
			{/* Header */}
			<div>
				<h1 className="font-bold text-2xl tracking-tight">Sessions</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					{activeSessions.length} active, {recentSessions.length} recent
				</p>
			</div>

			{/* Filter toggle */}
			<div className="flex gap-1 rounded-2xl bg-secondary p-1">
				<button
					className={cn(
						"flex-1 rounded-xl px-4 py-2.5 font-medium text-sm transition-all",
						filter === "active"
							? "bg-primary text-primary-foreground shadow-sm"
							: "text-muted-foreground",
					)}
					onClick={() => setFilter("active")}
					type="button"
				>
					Active ({activeSessions.length})
				</button>
				<button
					className={cn(
						"flex-1 rounded-xl px-4 py-2.5 font-medium text-sm transition-all",
						filter === "recent"
							? "bg-primary text-primary-foreground shadow-sm"
							: "text-muted-foreground",
					)}
					onClick={() => setFilter("recent")}
					type="button"
				>
					Recent ({recentSessions.length})
				</button>
			</div>

			{/* Session list */}
			{isLoading ? (
				<div className="flex flex-col gap-3">
					{[1, 2, 3].map((i) => (
						<div
							className="h-20 animate-pulse rounded-2xl bg-card ring-1 ring-border"
							key={i}
						/>
					))}
				</div>
			) : displayedSessions.length > 0 ? (
				<div className="flex flex-col gap-2">
					{displayedSessions.map((session) => (
						<SessionRow
							isHighlighted={sheetSession?.id === session.id}
							key={session.id}
							moneyFormat={moneyFormat}
							onOpen={setSheetSession}
							session={session}
						/>
					))}
				</div>
			) : (
				<div className="flex flex-col items-center justify-center rounded-2xl bg-card px-6 py-12 text-center ring-1 ring-border">
					<p className="font-medium text-muted-foreground">
						{filter === "active"
							? "No active vehicles in this lot"
							: "No recent closed sessions"}
					</p>
					<p className="mt-1 text-muted-foreground/60 text-xs">
						{filter === "active"
							? "Create an entry from the Gate tab"
							: "Completed sessions will appear here"}
					</p>
				</div>
			)}

			<SessionDetailSheet
				baseRate={baseRate}
				moneyFormat={moneyFormat}
				onEdit={onSelectSession}
				onOpenChange={(open) => {
					if (!open) setSheetSession(null);
				}}
				onReceiptReady={onReceiptReady}
				open={sheetSession !== null}
				parkingLotName={parkingLotName}
				session={sheetSession}
			/>
		</div>
	);
}
