"use client";

import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
	formatCurrency,
	formatDateTime,
	formatDuration,
	unwrapApiResult,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	ReceiptPreview,
	SessionLists,
	SessionSnapshot,
} from "@/features/operator-operations/models/operator-operations.types";
import { cn } from "@/lib/utils";
import { eden } from "@/server/eden";

interface SessionsTabProps {
	sessions: SessionLists | null;
	isLoading: boolean;
	onSelectSession: (session: SessionSnapshot) => void;
	baseRate: number;
	onReceiptReady: (preview: ReceiptPreview, sessionId: string) => void;
}

type SessionFilter = "active" | "recent";

function SessionRow({
	session,
	onSelect,
	isExpanded,
}: {
	session: SessionSnapshot;
	onSelect: (session: SessionSnapshot) => void;
	isExpanded: boolean;
}) {
	const isActive = session.status === "active";

	return (
		<button
			className={cn(
				"flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left ring-1 ring-border transition-transform active:scale-[0.98]",
				isExpanded && "ring-primary/40",
			)}
			onClick={() => onSelect(session)}
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
				<div className="mt-0.5 flex items-center gap-2 text-muted-foreground text-xs">
					<span className="truncate">{session.customerName || "No name"}</span>
					<span className="shrink-0">
						{session.customerPhone || "No phone"}
					</span>
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
							{formatDateTime(session.entryAt).split(",")[1]?.trim() ??
								formatDateTime(session.entryAt)}
						</p>
					</>
				) : (
					<>
						<p className="font-semibold text-sm">
							{session.finalAmount != null
								? formatCurrency(session.finalAmount)
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

function ExitPanel({
	session,
	baseRate,
	onReceiptReady,
	onCancel,
}: {
	session: SessionSnapshot;
	baseRate: number;
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
		},
	});

	return (
		<div className="rounded-2xl bg-card p-4 ring-1 ring-primary/30">
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
				<div className="rounded-xl bg-secondary p-2.5">
					<p className="text-muted-foreground">Entered</p>
					<p className="mt-0.5 font-medium">
						{formatDateTime(session.entryAt)}
					</p>
				</div>
				<div className="rounded-xl bg-secondary p-2.5">
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
						className="h-11 rounded-xl bg-secondary px-3 text-base"
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
						className="h-11 rounded-xl bg-secondary px-3 text-base"
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

export function SessionsTab({
	sessions,
	isLoading,
	onSelectSession,
	baseRate,
	onReceiptReady,
}: SessionsTabProps) {
	const [filter, setFilter] = useState<SessionFilter>("active");
	const [exitSessionId, setExitSessionId] = useState<string | null>(null);

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
						<div className="flex flex-col gap-2" key={session.id}>
							<SessionRow
								isExpanded={exitSessionId === session.id}
								onSelect={(s) => {
									if (s.status === "active") {
										setExitSessionId(exitSessionId === s.id ? null : s.id);
									} else {
										onSelectSession(s);
									}
								}}
								session={session}
							/>
							{/* Inline exit panel for active sessions */}
							{session.status === "active" && exitSessionId === session.id && (
								<ExitPanel
									baseRate={baseRate}
									onCancel={() => setExitSessionId(null)}
									onReceiptReady={(preview, sid) => {
										setExitSessionId(null);
										onReceiptReady(preview, sid);
									}}
									session={session}
								/>
							)}
						</div>
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
		</div>
	);
}
