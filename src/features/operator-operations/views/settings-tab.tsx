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
import { Separator } from "@/components/ui/separator";
import { unwrapApiResult } from "@/features/operator-operations/lib/operator-operations.helpers";
import type { OperatorContext } from "@/features/operator-operations/models/operator-operations.types";
import { authClient } from "@/server/better-auth/client";
import { eden } from "@/server/eden";

interface SettingsTabProps {
	operatorContext: OperatorContext;
	selectedLotId: string | null;
	onSelectLot: (lotId: string) => void;
}

export function SettingsTab({
	operatorContext,
	selectedLotId,
	onSelectLot,
}: SettingsTabProps) {
	const queryClient = useQueryClient();
	const activeLot =
		operatorContext.allowedLots.find((l) => l.id === selectedLotId) ?? null;
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
			<div>
				<h1 className="font-bold text-2xl tracking-tight">Settings</h1>
			</div>

			{/* Profile */}
			<div className="rounded-2xl bg-card p-4 ring-1 ring-border">
				<div className="flex items-center gap-3">
					<div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15">
						<span className="font-bold text-lg text-primary">
							{(operatorContext.user.name ??
								operatorContext.user.email)?.[0]?.toUpperCase() ?? "U"}
						</span>
					</div>
					<div className="min-w-0 flex-1">
						<p className="truncate font-semibold">
							{operatorContext.user.name ?? "Operator"}
						</p>
						<p className="truncate text-muted-foreground text-sm">
							{operatorContext.user.email}
						</p>
					</div>
				</div>
			</div>

			{/* Organization */}
			<div className="rounded-2xl bg-card p-4 ring-1 ring-border">
				<p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
					Organization
				</p>
				<p className="font-semibold text-lg">
					{operatorContext.tenant?.name ?? "No organization"}
				</p>
			</div>

			{/* Lot selector */}
			<div className="rounded-2xl bg-card p-4 ring-1 ring-border">
				<p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
					Parking lot
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
					<>
						<div className="mt-3 flex items-center gap-2">
							<Badge className="rounded-lg" variant="outline">
								{activeLot.code}
							</Badge>
							<Badge
								className="rounded-lg"
								variant={
									activeLot.status === "active" ? "default" : "secondary"
								}
							>
								{activeLot.status}
							</Badge>
						</div>

						<Separator className="my-4" />

						<p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
							Base rate
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
					</>
				)}
			</div>

			{/* Logout */}
			<Button
				className="h-13 rounded-2xl text-base"
				onClick={() => logoutMutation.mutate()}
				type="button"
				variant="destructive"
			>
				Log out
			</Button>
		</div>
	);
}
