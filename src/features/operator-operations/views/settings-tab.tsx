"use client";

import {
	Badge,
	Button,
	Description,
	Input,
	Label,
	ListBox,
	Modal,
	Select,
	Separator,
	TextField,
	toast,
} from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import {
	COUNTRY_OPTIONS,
	CURRENCY_OPTIONS,
	currencyOptionDisplayName,
} from "@/features/operator-operations/lib/operator-locale.constants";
import {
	countryCodeToFlagEmoji,
	getCurrencySymbol,
} from "@/features/operator-operations/lib/operator-locale.display";
import type { OperatorContext } from "@/features/operator-operations/models/operator-operations.types";
import {
	postLotRateWithOffline,
	postParkingGateWithOffline,
	postParkingLotWithOffline,
	postSelectGateWithOffline,
	postSelectLotWithOffline,
} from "@/features/operator-operations/sync/operator.actions";
import {
	clearAllOperatorDataForUser,
	clearLastActiveUserId,
} from "@/features/operator-operations/sync/operator.store";
import { cn } from "@/lib/utils";
import { authClient } from "@/server/better-auth/client";

interface SettingsTabProps {
	operatorContext: OperatorContext;
	selectedLotId: string | null;
	onSelectLot: (lotId: string) => void;
	userId: string;
}

const fieldTriggerClass =
	"min-h-12 w-full rounded-xl border border-accent/10 bg-white px-4 shadow-none ring-0 transition-colors hover:border-accent/18 hover:bg-accent/4 focus-visible:border-accent/40 focus-visible:ring-[3px] focus-visible:ring-accent/15";

function SettingsSection({
	children,
	className,
	title,
	description,
}: {
	children: ReactNode;
	className?: string;
	title: string;
	description?: string;
}) {
	return (
		<section
			className={cn(
				"rounded-2xl border border-accent/10 bg-white p-5 shadow-black/3 shadow-sm",
				className,
			)}
		>
			<div className="mb-4">
				<h2 className="font-semibold text-base text-foreground tracking-tight">
					{title}
				</h2>
				{description ? (
					<p className="mt-1 text-accent/80 text-sm leading-relaxed">
						{description}
					</p>
				) : null}
			</div>
			{children}
		</section>
	);
}

export function SettingsTab({
	operatorContext,
	selectedLotId,
	onSelectLot,
	userId,
}: SettingsTabProps) {
	const queryClient = useQueryClient();
	const activeLot =
		operatorContext.allowedLots.find((l) => l.id === selectedLotId) ?? null;
	const gatesForLot = operatorContext.gatesForSelectedLot ?? [];
	const selectedGateId = operatorContext.selectedParkingGateId ?? null;
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
	const [newLotName, setNewLotName] = useState("");
	const [newLotBaseRate, setNewLotBaseRate] = useState("");
	const [addLotOpen, setAddLotOpen] = useState(false);

	useEffect(() => {
		if (!activeLot) return;
		setCurrentBaseRate(String(activeLot.baseRate ?? 0));
		setCurrencyCode(activeLot.currencyCode);
		setCountryCode(activeLot.countryCode);
	}, [activeLot]);

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

	const createLotMutation = useMutation({
		mutationFn: async () => {
			const trimmed = newLotName.trim();
			if (trimmed.length < 2) {
				throw new Error("Lot name must be at least 2 characters.");
			}
			const rateRaw = newLotBaseRate.trim();
			const payload: { baseRate?: number; name: string } = { name: trimmed };
			if (rateRaw.length > 0) {
				const n = Number(rateRaw);
				if (!Number.isFinite(n) || n < 0) {
					throw new Error("Starting rate must be a valid non-negative number.");
				}
				payload.baseRate = n;
			}
			const ctx = await postParkingLotWithOffline({
				...payload,
				userId,
			});
			if (!ctx) {
				throw new Error(
					"Could not add parking lot while offline. Connect and try again.",
				);
			}
			return ctx;
		},
		onError: (error) => {
			toast.danger(
				error instanceof Error ? error.message : "Could not add parking lot.",
				{ timeout: 2500 },
			);
		},
		onSuccess: async (context) => {
			setNewLotName("");
			setNewLotBaseRate("");
			setAddLotOpen(false);
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
			const ctx = await postParkingGateWithOffline({
				name: trimmed,
				parkingLotId: selectedLotId ?? "",
				userId,
			});
			if (!ctx) {
				throw new Error(
					"Could not create gate while offline. Connect and try again.",
				);
			}
			return ctx;
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
		mutationFn: async (parkingGateId: string) => {
			const ctx = await postSelectGateWithOffline({
				operatorContext,
				parkingGateId,
				userId,
			});
			if (!ctx) {
				throw new Error("Could not switch gate.");
			}
			return ctx;
		},
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
			return postLotRateWithOffline({
				baseRate: rate,
				countryCode,
				currencyCode,
				operatorContext,
				parkingLotId: selectedLotId ?? "",
				userId,
			});
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["operator-context"] });
		},
	});

	const logoutMutation = useMutation({
		mutationFn: async () => {
			await clearAllOperatorDataForUser(userId);
			await clearLastActiveUserId();
			await authClient.signOut();
		},
	});

	const hasWorkspace = Boolean(operatorContext.tenant);

	return (
		<div className="safe-top flex flex-col gap-6 px-5 pt-6 pb-4">
			<header className="space-y-1">
				<h1 className="font-bold text-2xl text-foreground tracking-tight">
					Settings
				</h1>
				<p className="text-accent/85 text-sm">
					Account, lots, and lane setup for your workspace.
				</p>
			</header>

			<SettingsSection title="Profile">
				<div className="flex items-center gap-4">
					<div
						aria-hidden
						className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent/12 ring-1 ring-accent/12"
					>
						<span className="font-semibold text-accent text-lg">
							{(operatorContext.user.name ??
								operatorContext.user.email)?.[0]?.toUpperCase() ?? "U"}
						</span>
					</div>
					<div className="min-w-0 flex-1">
						<p className="truncate font-semibold text-foreground">
							{operatorContext.user.name ?? "Operator"}
						</p>
						<p className="truncate text-accent/80 text-sm">
							{operatorContext.user.email}
						</p>
					</div>
				</div>
			</SettingsSection>

			<SettingsSection
				description="Used for receipts and reports across your account."
				title="Organization"
			>
				<p className="font-medium text-foreground text-lg leading-snug">
					{operatorContext.tenant?.name ?? "No organization"}
				</p>
			</SettingsSection>

			{hasWorkspace ? (
				<SettingsSection
					description="Switch between sites you operate. Add a new lot to track another location under the same organization."
					title="Parking lots"
				>
					<Select
						className="w-full"
						isDisabled={selectLotMutation.isPending}
						onChange={(key) => {
							if (key == null) return;
							const id = String(key);
							onSelectLot(id);
							selectLotMutation.mutate(id);
						}}
						placeholder="Select parking lot"
						value={selectedLotId}
					>
						<Label className="font-medium text-accent text-xs uppercase tracking-wider">
							Active lot
						</Label>
						<Select.Trigger className={cn(fieldTriggerClass, "w-full")}>
							<Select.Value />
							<Select.Indicator />
						</Select.Trigger>
						<Select.Popover className="max-h-[min(24rem,70vh)]">
							<ListBox>
								{operatorContext.allowedLots.map((lot) => (
									<ListBox.Item id={lot.id} key={lot.id} textValue={lot.name}>
										{lot.name}
										<ListBox.ItemIndicator />
									</ListBox.Item>
								))}
							</ListBox>
						</Select.Popover>
					</Select>

					<div className="mt-6">
						<Button
							className="h-12 w-full rounded-xl border border-accent/12 bg-white px-5 text-accent hover:border-accent/22 hover:bg-accent/6 hover:text-accent sm:w-auto"
							onPress={() => setAddLotOpen(true)}
							variant="secondary"
						>
							Add another parking lot
						</Button>

						<Modal.Backdrop
							isOpen={addLotOpen}
							onOpenChange={(open) => {
								setAddLotOpen(open);
								if (!open) {
									setNewLotName("");
									setNewLotBaseRate("");
								}
							}}
						>
							<Modal.Container>
								<Modal.Dialog className="sm:max-w-md">
									<Modal.CloseTrigger />
									<Modal.Header>
										<Modal.Heading>Add parking lot</Modal.Heading>
									</Modal.Header>
									<Modal.Body className="flex flex-col gap-4">
										<Description className="text-accent/80 text-sm leading-relaxed">
											Creates a new lot with a default &quot;Main gate&quot;
											lane. You can add more lanes below once it is created.
										</Description>
										<TextField
											className="w-full"
											name="newLotName"
											onChange={setNewLotName}
											value={newLotName}
										>
											<Label>Lot name</Label>
											<Input placeholder="e.g. Riverside deck" />
										</TextField>
										<TextField
											className="w-full"
											name="newLotBaseRate"
											onChange={setNewLotBaseRate}
											value={newLotBaseRate}
										>
											<Label>
												Starting rate{" "}
												<span className="font-normal text-accent/70 normal-case">
													(optional)
												</span>
											</Label>
											<Input
												min={0}
												placeholder="Match current lot"
												step={1}
												type="number"
											/>
										</TextField>
									</Modal.Body>
									<Modal.Footer className="gap-3 border-accent/10 border-t pt-2 sm:justify-end">
										<Button slot="close" variant="secondary">
											Cancel
										</Button>
										<Button
											isDisabled={
												createLotMutation.isPending ||
												newLotName.trim().length < 2
											}
											onPress={() => createLotMutation.mutate()}
										>
											{createLotMutation.isPending ? "Adding…" : "Add lot"}
										</Button>
									</Modal.Footer>
								</Modal.Dialog>
							</Modal.Container>
						</Modal.Backdrop>
					</div>

					{activeLot ? (
						<>
							<div className="mt-5 flex flex-wrap items-center gap-2">
								<Badge className="rounded-lg font-mono" variant="secondary">
									{activeLot.code}
								</Badge>
								<Badge
									className="rounded-lg"
									color={activeLot.status === "active" ? "success" : "default"}
									variant="soft"
								>
									{activeLot.status}
								</Badge>
							</div>

							<Separator className="my-6 bg-accent/7" />

							<p className="mb-1 font-medium text-accent text-xs uppercase tracking-wider">
								Currency and country
							</p>
							<p className="mb-4 text-accent/80 text-sm">
								Used for money and date formatting across this lot.
							</p>
							<div className="grid gap-4 sm:grid-cols-2">
								<Select
									className="w-full min-w-0"
									onChange={(key) => {
										if (key == null) return;
										setCurrencyCode(String(key));
									}}
									placeholder="Select currency"
									value={currencyCode}
								>
									<Label className="font-medium text-accent text-xs uppercase tracking-wider">
										Currency
									</Label>
									<Select.Trigger
										className={cn(fieldTriggerClass, "min-w-0 px-3")}
									>
										<Select.Value />
										<Select.Indicator />
									</Select.Trigger>
									<Select.Popover className="max-h-[min(24rem,70vh)]">
										<ListBox>
											{CURRENCY_OPTIONS.map((c) => {
												const sym = getCurrencySymbol(c.code);
												const name = currencyOptionDisplayName(c.label);
												return (
													<ListBox.Item
														id={c.code}
														key={c.code}
														textValue={`${name} (${c.code})`}
													>
														<span className="flex min-w-0 flex-1 items-center gap-2 text-start">
															<span
																aria-hidden
																className="flex h-8 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 font-semibold text-accent text-sm tabular-nums"
															>
																{sym}
															</span>
															<span className="min-w-0 truncate font-medium leading-tight">
																{name}
															</span>
															<span className="shrink-0 font-medium text-accent/70 text-xs tabular-nums">
																{c.code}
															</span>
														</span>
														<ListBox.ItemIndicator />
													</ListBox.Item>
												);
											})}
										</ListBox>
									</Select.Popover>
								</Select>

								<Select
									className="w-full min-w-0"
									onChange={(key) => {
										if (key == null) return;
										setCountryCode(String(key));
									}}
									placeholder="Select country"
									value={countryCode}
								>
									<Label className="font-medium text-accent text-xs uppercase tracking-wider">
										Country or region
									</Label>
									<Select.Trigger
										className={cn(fieldTriggerClass, "min-w-0 px-3")}
									>
										<Select.Value />
										<Select.Indicator />
									</Select.Trigger>
									<Select.Popover className="max-h-[min(24rem,70vh)]">
										<ListBox>
											{COUNTRY_OPTIONS.map((c) => {
												const flag = countryCodeToFlagEmoji(c.code);
												return (
													<ListBox.Item
														id={c.code}
														key={c.code}
														textValue={`${c.name} (${c.code})`}
													>
														<span className="flex min-w-0 flex-1 items-center gap-2 text-start">
															<span
																aria-hidden
																className="flex h-8 w-10 shrink-0 items-center justify-center text-xl leading-none"
															>
																{flag}
															</span>
															<span className="min-w-0 truncate font-medium leading-tight">
																{c.name}
															</span>
															<span className="shrink-0 font-medium text-accent/70 text-xs tabular-nums">
																{c.code}
															</span>
														</span>
														<ListBox.ItemIndicator />
													</ListBox.Item>
												);
											})}
										</ListBox>
									</Select.Popover>
								</Select>
							</div>

							<Separator className="my-6 bg-accent/7" />

							<div className="flex flex-col gap-1.5">
								<div className="flex flex-col gap-3">
									<TextField
										className="w-full min-w-0"
										name="baseRate"
										onChange={setCurrentBaseRate}
										value={currentBaseRate}
									>
										<Label className="font-medium text-accent text-xs uppercase tracking-wider">
											Base rate
										</Label>
										<Input
											className="tabular-nums"
											min={0}
											step={1}
											type="number"
										/>
									</TextField>
									<Button
										className="h-12 w-full rounded-xl px-5"
										isDisabled={!selectedLotId || setLotRateMutation.isPending}
										onPress={() => setLotRateMutation.mutate()}
									>
										{setLotRateMutation.isPending ? "Saving..." : "Save"}
									</Button>
								</div>
							</div>

							<Separator className="my-6 bg-accent/7" />

							<p className="mb-1 font-medium text-accent text-xs uppercase tracking-wider">
								Gates & lanes
							</p>
							<p className="mb-3 text-accent/80 text-sm">
								Add entry or exit lanes for this lot. New entries record which
								lane was used.
							</p>

							{gatesForLot.length > 0 ? (
								<ul className="mb-4 flex flex-col gap-2">
									{gatesForLot.map((gate) => (
										<li
											className="flex items-center justify-between rounded-xl border border-accent/10 bg-white px-3 py-2.5 text-sm"
											key={gate.id}
										>
											<span className="font-medium text-foreground">
												{gate.name}
											</span>
											<Badge
												className="rounded-md font-mono text-[0.65rem]"
												variant="secondary"
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
								<TextField
									className="min-w-0 flex-1"
									name="newGateName"
									onChange={setNewGateName}
									value={newGateName}
								>
									<Input placeholder="North entry, Basement ramp…" />
								</TextField>
								<Button
									className="h-12 shrink-0 rounded-xl border border-accent/12 bg-white px-5 text-accent hover:border-accent/22 hover:bg-accent/6 hover:text-accent"
									isDisabled={
										!selectedLotId ||
										createGateMutation.isPending ||
										newGateName.trim().length < 2
									}
									onPress={() => createGateMutation.mutate()}
									variant="secondary"
								>
									{createGateMutation.isPending ? "Adding…" : "Add gate"}
								</Button>
							</div>

							{gatesForLot.length > 1 ? (
								<div className="mt-5">
									<Select
										className="w-full"
										isDisabled={selectGateMutation.isPending}
										onChange={(key) => {
											if (key == null) return;
											selectGateMutation.mutate(String(key));
										}}
										placeholder="Select working gate"
										value={selectedGateId}
									>
										<Label className="mb-2 font-medium text-accent text-xs uppercase tracking-wider">
											Working lane
										</Label>
										<Select.Trigger className={cn(fieldTriggerClass, "w-full")}>
											<Select.Value />
											<Select.Indicator />
										</Select.Trigger>
										<Select.Popover>
											<ListBox>
												{gatesForLot.map((gate) => (
													<ListBox.Item
														id={gate.id}
														key={gate.id}
														textValue={gate.name}
													>
														{gate.name}
														<ListBox.ItemIndicator />
													</ListBox.Item>
												))}
											</ListBox>
										</Select.Popover>
									</Select>
								</div>
							) : null}
						</>
					) : null}
				</SettingsSection>
			) : null}

			<Button
				className="h-12 rounded-2xl border border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15"
				onPress={() => logoutMutation.mutate()}
				variant="secondary"
			>
				Log out
			</Button>
		</div>
	);
}
