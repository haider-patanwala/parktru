"use client";

import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import {
	COUNTRY_OPTIONS,
	CURRENCY_OPTIONS,
} from "@/features/operator-operations/lib/operator-locale.constants";
import {
	countryCodeToFlagEmoji,
	getCurrencySymbol,
} from "@/features/operator-operations/lib/operator-locale.display";
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
	const gatesForLot = operatorContext.gatesForSelectedLot ?? [];
	const selectedGateId = operatorContext.selectedParkingGateId ?? null;
	const selectedGate = gatesForLot.find((g) => g.id === selectedGateId) ?? null;
	const [currentBaseRate, setCurrentBaseRate] = useState(
		String(activeLot?.baseRate ?? 0),
	);
	const [currencyCode, setCurrencyCode] = useState(
		activeLot?.currencyCode ?? "INR",
	);
	const [countryCode, setCountryCode] = useState(
		activeLot?.countryCode ?? "IN",
	);
	const [newGateName, setNewGateName] = useState("");

	useEffect(() => {
		if (!activeLot) return;
		setCurrentBaseRate(String(activeLot.baseRate ?? 0));
		setCurrencyCode(activeLot.currencyCode);
		setCountryCode(activeLot.countryCode);
	}, [activeLot]);

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

	const createGateMutation = useMutation({
		mutationFn: async () => {
			const trimmed = newGateName.trim();
			if (trimmed.length < 2)
				throw new Error("Gate name must be at least 2 characters.");
			return unwrapApiResult<OperatorContext>(
				await eden.operator["parking-gate"].post({
					name: trimmed,
					parkingLotId: selectedLotId ?? "",
				}),
			);
		},
		onError: (error) => {
			toast.danger(
				error instanceof Error ? error.message : "Could not create gate.",
				{ timeout: 2000 },
			);
		},
		onSuccess: async () => {
			setNewGateName("");
			await queryClient.invalidateQueries({ queryKey: ["operator-context"] });
		},
	});

	const selectGateMutation = useMutation({
		mutationFn: async (parkingGateId: string) =>
			unwrapApiResult<OperatorContext>(
				await eden.operator["select-gate"].post({ parkingGateId }),
			),
		onSuccess: async () => {
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
					countryCode,
					currencyCode,
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
						<p className="truncate text-accent/75 text-sm">
							{operatorContext.user.email}
						</p>
					</div>
				</div>
			</div>

			{/* Organization */}
			<div className="rounded-2xl bg-card p-4 ring-1 ring-border">
				<p className="mb-3 font-medium text-accent text-xs uppercase tracking-wider">
					Organization
				</p>
				<p className="font-semibold text-lg">
					{operatorContext.tenant?.name ?? "No organization"}
				</p>
			</div>

			{/* Lot selector */}
			<div className="rounded-2xl bg-card p-4 ring-1 ring-border">
				<p className="mb-3 font-medium text-accent text-xs uppercase tracking-wider">
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
						className="h-12 w-full rounded-xl border border-accent/25 bg-accent/15 px-4 ring-1 ring-accent/15"
						size="default"
					>
						<SelectValue placeholder="Select parking lot">
							{activeLot?.name}
						</SelectValue>
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

						<p className="mb-1 font-medium text-accent text-xs uppercase tracking-wider">
							Currency and country
						</p>
						<p className="mb-4 text-accent/75 text-sm">
							Used for money and date formatting across this lot.
						</p>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="flex min-w-0 flex-col gap-1.5">
								<label
									className="font-medium text-accent text-xs uppercase tracking-wider"
									htmlFor="settings-lot-currency"
								>
									Currency
								</label>
								<Select
									onValueChange={(value) => {
										if (!value) return;
										setCurrencyCode(value);
									}}
									value={currencyCode}
								>
									<SelectTrigger
										className="h-12 w-full min-w-0 rounded-xl border border-accent/25 bg-accent/15 px-3 ring-1 ring-accent/15"
										id="settings-lot-currency"
										size="default"
									>
										<SelectValue placeholder="Select currency" />
									</SelectTrigger>
									<SelectContent className="max-h-[min(24rem,70vh)]">
										<SelectGroup>
											{CURRENCY_OPTIONS.map((c) => {
												const sym = getCurrencySymbol(c.code);
												return (
													<SelectItem
														key={c.code}
														label={`${sym} ${c.label}`}
														value={c.code}
													>
														<span
															aria-hidden
															className="flex h-8 w-10 shrink-0 items-center justify-center rounded-lg bg-accent font-semibold text-accent-foreground text-sm tabular-nums"
														>
															{sym}
														</span>
														<span className="min-w-0 truncate text-start">
															{c.label}
														</span>
													</SelectItem>
												);
											})}
										</SelectGroup>
									</SelectContent>
								</Select>
							</div>
							<div className="flex min-w-0 flex-col gap-1.5">
								<label
									className="font-medium text-accent text-xs uppercase tracking-wider"
									htmlFor="settings-lot-country"
								>
									Country or region
								</label>
								<Select
									onValueChange={(value) => {
										if (!value) return;
										setCountryCode(value);
									}}
									value={countryCode}
								>
									<SelectTrigger
										className="h-12 w-full min-w-0 rounded-xl border border-accent/25 bg-accent/15 px-3 ring-1 ring-accent/15"
										id="settings-lot-country"
										size="default"
									>
										<SelectValue placeholder="Select country" />
									</SelectTrigger>
									<SelectContent className="max-h-[min(24rem,70vh)]">
										<SelectGroup>
											{COUNTRY_OPTIONS.map((c) => {
												const flag = countryCodeToFlagEmoji(c.code);
												return (
													<SelectItem
														key={c.code}
														label={`${c.name} (${c.code})`}
														value={c.code}
													>
														<span
															aria-hidden
															className="flex h-8 w-10 shrink-0 items-center justify-center text-xl leading-none"
														>
															{flag}
														</span>
														<span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-start">
															<span className="truncate font-medium leading-tight">
																{c.name}
															</span>
															<span className="text-accent/70 text-xs leading-tight">
																{c.code}
															</span>
														</span>
													</SelectItem>
												);
											})}
										</SelectGroup>
									</SelectContent>
								</Select>
							</div>
						</div>

						<Separator className="my-4" />

						<div className="flex flex-col gap-1.5">
							<label
								className="font-medium text-accent text-xs uppercase tracking-wider"
								htmlFor="settings-lot-base-rate"
							>
								Base rate
							</label>
							<div className="flex gap-3">
								<Input
									className="h-12 flex-1 rounded-xl border border-accent/25 bg-accent/15 px-4 text-base ring-1 ring-accent/15 placeholder:text-accent/45"
									id="settings-lot-base-rate"
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

						<Separator className="my-4" />

						<p className="mb-3 font-medium text-accent text-xs uppercase tracking-wider">
							Gates & lanes
						</p>
						<p className="mb-3 text-accent/75 text-sm">
							Add entry or exit lanes for this lot. New sessions record which
							lane was used.
						</p>

						{gatesForLot.length > 0 ? (
							<ul className="mb-4 flex flex-col gap-2">
								{gatesForLot.map((gate) => (
									<li
										className="flex items-center justify-between rounded-xl border border-accent/20 bg-accent/10 px-3 py-2 text-sm ring-1 ring-accent/10"
										key={gate.id}
									>
										<span className="font-medium">{gate.name}</span>
										<Badge
											className="rounded-md font-mono text-[0.65rem]"
											variant="outline"
										>
											{gate.code}
										</Badge>
									</li>
								))}
							</ul>
						) : (
							<p className="mb-4 text-accent/75 text-sm">
								No gates yet for this lot.
							</p>
						)}

						<div className="flex flex-col gap-3 sm:flex-row">
							<Input
								className="h-12 flex-1 rounded-xl border border-accent/25 bg-accent/15 px-4 text-base ring-1 ring-accent/15 placeholder:text-accent/45"
								onChange={(event) => setNewGateName(event.target.value)}
								placeholder="North entry, Basement ramp…"
								value={newGateName}
							/>
							<Button
								className="h-12 shrink-0 rounded-xl px-5"
								disabled={
									!selectedLotId ||
									createGateMutation.isPending ||
									newGateName.trim().length < 2
								}
								onClick={() => createGateMutation.mutate()}
								type="button"
							>
								{createGateMutation.isPending ? "Adding…" : "Add gate"}
							</Button>
						</div>

						{gatesForLot.length > 1 ? (
							<div className="mt-4">
								<p className="mb-2 font-medium text-accent text-xs uppercase tracking-wider">
									Working lane
								</p>
								<Select
									disabled={selectGateMutation.isPending}
									onValueChange={(value) => {
										if (!value) return;
										selectGateMutation.mutate(value);
									}}
									value={selectedGateId}
								>
									<SelectTrigger
										className="h-12 w-full rounded-xl border border-accent/25 bg-accent/15 px-4 ring-1 ring-accent/15"
										size="default"
									>
										<SelectValue placeholder="Select working gate">
											{selectedGate?.name}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{gatesForLot.map((gate) => (
												<SelectItem
													key={gate.id}
													label={gate.name}
													value={gate.id}
												>
													{gate.name}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							</div>
						) : null}
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
