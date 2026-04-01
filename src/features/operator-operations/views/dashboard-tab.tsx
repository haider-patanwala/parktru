"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
	unwrapApiResult,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	OperatorContext,
	SessionLists,
} from "@/features/operator-operations/models/operator-operations.types";
import { authClient } from "@/server/better-auth/client";
import { eden } from "@/server/eden";
import type { TabId } from "./operator-shell";

interface DashboardTabProps {
	operatorContext: OperatorContext;
	selectedLotId: string | null;
	onSelectLot: (lotId: string) => void;
	sessions: SessionLists | null;
	onNavigate: (tab: TabId) => void;
}

export function DashboardTab({
	operatorContext,
	selectedLotId,
	onSelectLot,
	sessions,
	onNavigate,
}: DashboardTabProps) {
	const queryClient = useQueryClient();
	const activeLot =
		operatorContext.allowedLots.find((l) => l.id === selectedLotId) ?? null;
	const activeCount = sessions?.activeSessions.length ?? 0;
	const recentCount = sessions?.recentSessions.length ?? 0;
	const [currentBaseRate, setCurrentBaseRate] = useState(
		String(activeLot?.baseRate ?? 0),
	);

	const selectLotMutation = useMutation({
		mutationFn: async (parkingLotId: string) =>
			unwrapApiResult<OperatorContext>(
				await eden.operator["select-lot"].post({ parkingLotId }),
			),
		onSuccess: async (context) => {
			onSelectLot(context.selectedParkingLotId ?? "");
			await queryClient.invalidateQueries({ queryKey: ["operator-context"] });
			await queryClient.invalidateQueries({ queryKey: ["operator-sessions"] });
		},
	});

	const setLotRateMutation = useMutation({
		mutationFn: async () => {
			const rate = Number(currentBaseRate);
			if (!Number.isFinite(rate) || rate < 0)
				throw new Error("Base rate must be a valid non-negative number.");
			return unwrapApiResult<boolean>(
				await eden.operator["lot-rate"].post({
					baseRate: rate,
					parkingLotId: selectedLotId ?? "",
				}),
			);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["operator-context"] });
		},
	});

	const logoutMutation = useMutation({
		mutationFn: async () => {
			await authClient.signOut();
		},
	});

	return (
		<div className="safe-top flex flex-col gap-5 px-5 pt-6 pb-4">
			{/* Header */}
			<div className="flex items-start justify-between">
				<div>
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
						{operatorContext.tenant?.name}
					</p>
					<h1 className="mt-1 font-bold text-2xl tracking-tight">Dashboard</h1>
				</div>
				<Button
					className="rounded-xl text-muted-foreground"
					onClick={() => logoutMutation.mutate()}
					size="sm"
					variant="ghost"
				>
					Log out
				</Button>
			</div>

			{/* Lot selector */}
			<div className="rounded-2xl bg-card p-4 ring-1 ring-border">
				<p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
					Active lot
				</p>
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
						className="h-12 w-full rounded-xl bg-secondary px-4"
						size="default"
					>
						<SelectValue placeholder="Select parking lot" />
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
				{activeLot && (
					<div className="mt-3 flex items-center gap-2">
						<Badge className="rounded-lg" variant="outline">
							{activeLot.code}
						</Badge>
						<Badge
							className="rounded-lg"
							variant={activeLot.status === "active" ? "default" : "secondary"}
						>
							{activeLot.status}
						</Badge>
					</div>
				)}
			</div>

			{/* Stats grid */}
			<div className="grid grid-cols-2 gap-3">
				<button
					className="rounded-2xl bg-primary/10 p-4 text-left transition-transform active:scale-[0.97]"
					onClick={() => onNavigate("sessions")}
					type="button"
				>
					<p className="font-bold text-3xl text-primary">{activeCount}</p>
					<p className="mt-1 font-medium text-muted-foreground text-xs">
						Active vehicles
					</p>
				</button>

				<button
					className="rounded-2xl bg-card p-4 text-left ring-1 ring-border transition-transform active:scale-[0.97]"
					onClick={() => onNavigate("sessions")}
					type="button"
				>
					<p className="font-bold text-3xl">{recentCount}</p>
					<p className="mt-1 font-medium text-muted-foreground text-xs">
						Recent exits
					</p>
				</button>

				<button
					className="col-span-2 rounded-2xl bg-card p-4 text-left ring-1 ring-border transition-transform active:scale-[0.97]"
					onClick={() => onNavigate("gate")}
					type="button"
				>
					<div className="flex items-center justify-between">
						<div>
							<p className="font-semibold text-lg">
								{activeLot ? formatCurrency(activeLot.baseRate) : "--"}
							</p>
							<p className="mt-0.5 font-medium text-muted-foreground text-xs">
								Current base rate
							</p>
						</div>
						<span className="rounded-xl bg-primary/10 px-3 py-1.5 font-medium text-primary text-sm">
							Start gate
						</span>
					</div>
				</button>
			</div>

			{/* Rate management */}
			{activeLot && (
				<div className="rounded-2xl bg-card p-4 ring-1 ring-border">
					<p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
						Lot base rate
					</p>
					<div className="flex gap-3">
						<Input
							className="h-12 flex-1 rounded-xl bg-secondary px-4 text-base"
							min="0"
							onChange={(event) => setCurrentBaseRate(event.target.value)}
							step="1"
							type="number"
							value={currentBaseRate}
						/>
						<Button
							className="h-12 rounded-xl px-5"
							disabled={!selectedLotId || setLotRateMutation.isPending}
							onClick={() => setLotRateMutation.mutate()}
							type="button"
						>
							{setLotRateMutation.isPending ? "Saving..." : "Save"}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
