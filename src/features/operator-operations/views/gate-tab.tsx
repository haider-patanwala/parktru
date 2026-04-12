"use client";

import { Calendar, DateField, DatePicker, Label, toast } from "@heroui/react";
import type { DateValue } from "@internationalized/date";
import {
	now as dateNow,
	getLocalTimeZone,
	parseAbsoluteToLocal,
} from "@internationalized/date";
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
import {
	formatCurrency,
	formatDateTime,
	formatDuration,
	moneyFormatFromLot,
	normalizePlateNumber,
	toISOString,
	unwrapApiResult,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	OperatorContext,
	PlateLookupResult,
	ReceiptPreview,
	SessionSnapshot,
} from "@/features/operator-operations/models/operator-operations.types";
import { PlateCameraSheet } from "@/features/operator-operations/views/plate-camera-sheet";
import { eden } from "@/server/eden";

function dateValueFromEntryAt(entryAt: string | Date): DateValue {
	const iso = entryAt instanceof Date ? entryAt.toISOString() : String(entryAt);
	return parseAbsoluteToLocal(iso);
}

interface GateTabProps {
	operatorContext: OperatorContext;
	selectedLotId: string | null;
	onReceiptReady: (preview: ReceiptPreview, sessionId: string) => void;
}

type GateMode = "search" | "entry" | "exit" | "duplicate";

export function GateTab({
	operatorContext,
	selectedLotId,
	onReceiptReady,
}: GateTabProps) {
	const queryClient = useQueryClient();
	const activeLot =
		operatorContext.allowedLots.find((l) => l.id === selectedLotId) ?? null;
	const lotMoneyFormat = moneyFormatFromLot(activeLot);
	const gates = operatorContext.gatesForSelectedLot ?? [];
	const selectedGateId = operatorContext.selectedParkingGateId ?? null;
	const activeGate =
		gates.find((g) => g.id === selectedGateId) ?? gates[0] ?? null;

	const [mode, setMode] = useState<GateMode>("search");
	const [plateNumber, setPlateNumber] = useState("");
	const [customerName, setCustomerName] = useState("");
	const [customerPhone, setCustomerPhone] = useState("");
	const [vehicleType, setVehicleType] = useState("");
	const [lookupResult, setLookupResult] = useState<PlateLookupResult | null>(
		null,
	);
	const [isPlateCameraOpen, setIsPlateCameraOpen] = useState(false);
	const [entryTimeDraft, setEntryTimeDraft] = useState<DateValue | null>(null);
	const [finalAmount, setFinalAmount] = useState("0");
	const [overrideAmount, setOverrideAmount] = useState("");
	const activeSession = lookupResult?.activeSession ?? null;
	const currentBaseRate = activeLot?.baseRate ?? 0;

	const selectGateMutation = useMutation({
		mutationFn: async (parkingGateId: string) =>
			unwrapApiResult<OperatorContext>(
				await eden.operator["select-gate"].post({ parkingGateId }),
			),
		onError: (error) => {
			toast.danger(
				error instanceof Error ? error.message : "Could not switch gate.",
				{ timeout: 2000 },
			);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["operator-context"] });
		},
	});

	const resetForm = () => {
		setPlateNumber("");
		setCustomerName("");
		setCustomerPhone("");
		setVehicleType("");
		setLookupResult(null);
		setEntryTimeDraft(null);
		setFinalAmount("0");
		setOverrideAmount("");
		setMode("search");
	};

	const lookupMutation = useMutation({
		mutationFn: async () =>
			unwrapApiResult<PlateLookupResult>(
				await eden.operator.lookup.plate.post({ plateNumber }),
			),
		onError: (error) => {
			toast.danger(
				error instanceof Error ? error.message : "Plate lookup failed.",
				{ timeout: 2000 },
			);
		},
		onSuccess: (result) => {
			setLookupResult(result);
			setPlateNumber(result.normalizedPlateNumber);
			setCustomerName(result.customerDefaults?.customerName ?? "");
			setCustomerPhone(result.customerDefaults?.customerPhone ?? "");

			if (result.activeSession) {
				setMode("duplicate");
				setEntryTimeDraft(dateValueFromEntryAt(result.activeSession.entryAt));
				setFinalAmount(String(result.activeSession.baseRateSnapshot));
				setOverrideAmount(
					result.activeSession.overrideAmount
						? String(result.activeSession.overrideAmount)
						: "",
				);
			} else {
				setMode("entry");
				setFinalAmount(String(currentBaseRate));
				setOverrideAmount("");
			}
		},
	});

	const createEntryMutation = useMutation({
		mutationFn: async () =>
			unwrapApiResult<{
				created: boolean;
				duplicateSession: SessionSnapshot | null;
			}>(
				await eden.operator.entry.post({
					customerName,
					customerPhone,
					displayPlateNumber: plateNumber,
					parkingGateId: selectedGateId ?? undefined,
					parkingLotId: selectedLotId ?? "",
					vehicleType,
				}),
			),
		onError: (error) => {
			toast.danger(
				error instanceof Error ? error.message : "Entry creation failed.",
				{ timeout: 2000 },
			);
		},
		onSuccess: async (result) => {
			if (!result.created && result.duplicateSession) {
				setLookupResult({
					activeSession: result.duplicateSession,
					customerDefaults: { customerName, customerPhone },
					normalizedPlateNumber: normalizePlateNumber(plateNumber),
					recentMatches: [result.duplicateSession],
				});
				setMode("duplicate");
				setEntryTimeDraft(
					dateValueFromEntryAt(result.duplicateSession.entryAt),
				);
				return;
			}

			resetForm();
			await queryClient.invalidateQueries({ queryKey: ["operator-sessions"] });
		},
	});

	const updateEntryTimeMutation = useMutation({
		mutationFn: async () => {
			if (!entryTimeDraft) throw new Error("Please select an entry time.");
			return unwrapApiResult<boolean>(
				await eden.operator["entry-time"].post({
					entryAt: entryTimeDraft.toDate(getLocalTimeZone()).toISOString(),
					parkingSessionId: lookupResult?.activeSession?.id ?? "",
				}),
			);
		},
		onError: (error) => {
			toast.danger(
				error instanceof Error ? error.message : "Time correction failed.",
				{ timeout: 2000 },
			);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["operator-sessions"] });
			const freshLookup = await lookupMutation.mutateAsync();
			setLookupResult(freshLookup);
			setEntryTimeDraft(
				freshLookup.activeSession
					? dateValueFromEntryAt(freshLookup.activeSession.entryAt)
					: null,
			);
		},
	});

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
					parkingSessionId: lookupResult?.activeSession?.id ?? "",
				}),
			);
		},
		onError: (error) => {
			toast.danger(error instanceof Error ? error.message : "Exit failed.", {
				timeout: 2000,
			});
		},
		onSuccess: async (closed) => {
			const sessionId = lookupResult?.activeSession?.id ?? "";
			onReceiptReady(
				{
					amount: closed.amount,
					countryCode: activeLot?.countryCode ?? "IN",
					currencyCode: activeLot?.currencyCode ?? "INR",
					customerName: closed.customerName,
					customerPhone: closed.customerPhone,
					entryAt: closed.entryAt,
					exitAt: closed.exitAt,
					generatedAt: toISOString(new Date()),
					operatorName: closed.operatorName,
					parkingLotName: closed.parkingLotName,
					plateNumber: closed.plateNumber,
					receiptId: "",
					receiptNumber: "Preview",
					sharePath: "",
					tenantName: closed.tenantName,
				},
				sessionId,
			);
			resetForm();
			await queryClient.invalidateQueries({ queryKey: ["operator-sessions"] });
		},
	});

	if (!activeLot) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20">
				<div className="rounded-2xl bg-card p-6 text-center ring-1 ring-border">
					<p className="font-semibold text-lg">No lot selected</p>
					<p className="mt-2 text-muted-foreground text-sm">
						Select a parking lot from the Home tab to start gate operations.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="safe-top flex flex-col gap-4 px-5 pt-6 pb-4">
			<PlateCameraSheet
				onConfirm={setPlateNumber}
				onOpenChange={setIsPlateCameraOpen}
				open={isPlateCameraOpen}
			/>

			{/* Header */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0 flex-1">
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
						{activeLot.name}
					</p>
					<h1 className="mt-1 font-bold text-2xl tracking-tight">Gate</h1>
					{gates.length > 1 ? (
						<div className="mt-3 max-w-md">
							<p className="mb-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">
								Gate lane
							</p>
							<Select
								disabled={selectGateMutation.isPending}
								onValueChange={(value) => {
									if (!value) return;
									selectGateMutation.mutate(value);
								}}
								value={selectedGateId ?? undefined}
							>
								<SelectTrigger
									className="h-11 w-full rounded-xl bg-secondary px-3"
									size="default"
								>
									<SelectValue placeholder="Select gate">
										{activeGate?.name}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{gates.map((gate) => (
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
					) : activeGate ? (
						<p className="mt-2 text-muted-foreground text-sm">
							Lane: <span className="text-foreground">{activeGate.name}</span>
						</p>
					) : null}
				</div>
				<Badge className="shrink-0 self-start rounded-lg" variant="outline">
					{formatCurrency(currentBaseRate, lotMoneyFormat)} / entry
				</Badge>
			</div>

			{/* Search bar */}
			<div className="rounded-2xl bg-card p-4 ring-1 ring-border">
				<div className="flex gap-2">
					<Input
						className="h-14 flex-1 rounded-xl bg-secondary px-4 font-mono text-lg uppercase tracking-widest"
						onChange={(event) => setPlateNumber(event.target.value)}
						placeholder="MH12AB1234"
						value={plateNumber}
					/>
					<Button
						aria-label="Scan vehicle plate"
						className="h-14 rounded-xl px-4"
						onClick={() => setIsPlateCameraOpen(true)}
						type="button"
						variant="outline"
					>
						<svg
							aria-hidden="true"
							className="size-5"
							fill="none"
							stroke="currentColor"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="1.8"
							viewBox="0 0 24 24"
						>
							<path d="M4 8a2 2 0 012-2h2l1.2-1.4A2 2 0 0110.74 4h2.52a2 2 0 011.54.6L16 6h2a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
							<circle cx="12" cy="13" r="3.5" />
						</svg>
					</Button>
					<Button
						className="h-14 rounded-xl px-5 text-base"
						disabled={!plateNumber.trim() || lookupMutation.isPending}
						onClick={() => lookupMutation.mutate()}
						type="button"
					>
						{lookupMutation.isPending ? "..." : "Find"}
					</Button>
				</div>
			</div>

			{/* Duplicate warning */}
			{mode === "duplicate" && activeSession && (
				<div className="rounded-2xl bg-warning/10 p-4 ring-1 ring-warning/20">
					<div className="mb-3 flex items-center gap-2">
						<span className="size-2 rounded-full bg-warning" />
						<p className="font-semibold text-sm text-warning-foreground">
							Active session found
						</p>
					</div>
					<p className="font-bold font-mono text-xl tracking-wider">
						{activeSession.displayPlateNumber}
					</p>
					<p className="mt-1 text-muted-foreground text-sm">
						Entered{" "}
						{formatDateTime(activeSession.entryAt, lotMoneyFormat.countryCode)}{" "}
						at {activeSession.parkingLotName}
						{activeSession.parkingGateName
							? ` · ${activeSession.parkingGateName}`
							: ""}
					</p>

					<div className="mt-4">
						<DatePicker
							className="w-full"
							granularity="minute"
							hideTimeZone
							hourCycle={24}
							maxValue={dateNow(getLocalTimeZone())}
							onChange={setEntryTimeDraft}
							value={entryTimeDraft}
						>
							<Label>Correct entry time</Label>
							<DateField.Group>
								<DateField.Input>
									{(segment) => <DateField.Segment segment={segment} />}
								</DateField.Input>
								<DateField.Suffix>
									<DatePicker.Trigger>
										<DatePicker.TriggerIndicator />
									</DatePicker.Trigger>
								</DateField.Suffix>
							</DateField.Group>
							<DatePicker.Popover>
								<Calendar aria-label="Select entry date">
									<Calendar.Header>
										<Calendar.Heading />
										<Calendar.NavButton slot="previous" />
										<Calendar.NavButton slot="next" />
									</Calendar.Header>
									<Calendar.Grid>
										<Calendar.GridHeader>
											{(day) => (
												<Calendar.HeaderCell>{day}</Calendar.HeaderCell>
											)}
										</Calendar.GridHeader>
										<Calendar.GridBody>
											{(date) => <Calendar.Cell date={date} />}
										</Calendar.GridBody>
									</Calendar.Grid>
								</Calendar>
							</DatePicker.Popover>
						</DatePicker>
					</div>

					<div className="mt-4 flex gap-2">
						<Button
							className="h-12 flex-1 rounded-xl text-base"
							onClick={() => {
								setMode("exit");
								setFinalAmount(
									String(
										activeSession.overrideAmount ??
											activeLot.baseRate ??
											activeSession.baseRateSnapshot ??
											0,
									),
								);
							}}
							type="button"
						>
							Process exit
						</Button>
						<Button
							className="h-12 rounded-xl"
							onClick={() => updateEntryTimeMutation.mutate()}
							type="button"
							variant="outline"
						>
							{updateEntryTimeMutation.isPending ? "..." : "Fix time"}
						</Button>
					</div>
				</div>
			)}

			{/* Exit flow */}
			{mode === "exit" && activeSession && (
				<div className="rounded-2xl bg-card p-4 ring-1 ring-border">
					<div className="mb-4 flex items-center justify-between">
						<div>
							<p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
								Exit checkout
							</p>
							<p className="mt-1 font-bold font-mono text-xl tracking-wider">
								{activeSession.displayPlateNumber}
							</p>
						</div>
						<Badge className="rounded-lg text-sm" variant="secondary">
							{formatDuration(activeSession.entryAt, new Date())}
						</Badge>
					</div>

					<div className="mb-4 grid grid-cols-3 gap-2">
						<div className="rounded-xl bg-secondary p-3">
							<p className="font-medium text-[0.65rem] text-muted-foreground uppercase">
								Entered
							</p>
							<p className="mt-1 font-medium text-xs">
								{formatDateTime(
									activeSession.entryAt,
									lotMoneyFormat.countryCode,
								)}
							</p>
						</div>
						<div className="rounded-xl bg-secondary p-3">
							<p className="font-medium text-[0.65rem] text-muted-foreground uppercase">
								Customer
							</p>
							<p className="mt-1 font-medium text-xs">
								{activeSession.customerPhone || "N/A"}
							</p>
						</div>
						<div className="rounded-xl bg-secondary p-3">
							<p className="font-medium text-[0.65rem] text-muted-foreground uppercase">
								Base rate
							</p>
							<p className="mt-1 font-medium text-xs">
								{formatCurrency(activeSession.baseRateSnapshot, lotMoneyFormat)}
							</p>
						</div>
					</div>

					<Separator className="my-4" />

					<div className="grid grid-cols-2 gap-3">
						<div>
							<label
								className="mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wider"
								htmlFor="final-amount"
							>
								Final amount
							</label>
							<Input
								className="h-12 rounded-xl bg-secondary px-4 text-base"
								id="final-amount"
								min="0"
								onChange={(event) => setFinalAmount(event.target.value)}
								step="1"
								type="number"
								value={finalAmount}
							/>
						</div>
						<div>
							<label
								className="mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wider"
								htmlFor="override-amount"
							>
								Override
							</label>
							<Input
								className="h-12 rounded-xl bg-secondary px-4 text-base"
								id="override-amount"
								min="0"
								onChange={(event) => setOverrideAmount(event.target.value)}
								placeholder="Optional"
								step="1"
								type="number"
								value={overrideAmount}
							/>
						</div>
					</div>

					<div className="mt-4 flex gap-2">
						<Button
							className="h-13 flex-1 rounded-xl font-semibold text-base"
							disabled={closeExitMutation.isPending}
							onClick={() => closeExitMutation.mutate()}
							type="button"
						>
							{closeExitMutation.isPending ? "Closing..." : "Close exit"}
						</Button>
						<Button
							className="h-13 rounded-xl"
							onClick={() => setMode("duplicate")}
							type="button"
							variant="outline"
						>
							Back
						</Button>
					</div>
				</div>
			)}

			{/* Entry form */}
			{(mode === "search" || mode === "entry") && (
				<div className="rounded-2xl bg-card p-4 ring-1 ring-border">
					<p className="mb-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
						Vehicle entry
					</p>

					<div className="flex flex-col gap-3">
						<div>
							<label
								className="mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wider"
								htmlFor="plate-display"
							>
								Plate number
							</label>
							<Input
								className="h-13 rounded-xl bg-secondary px-4 font-mono text-base uppercase tracking-widest"
								id="plate-display"
								onChange={(event) => setPlateNumber(event.target.value)}
								placeholder="MH12AB1234"
								value={plateNumber}
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div>
								<label
									className="mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wider"
									htmlFor="customer-name"
								>
									Name
								</label>
								<Input
									className="h-12 rounded-xl bg-secondary px-4 text-base"
									id="customer-name"
									onChange={(event) => setCustomerName(event.target.value)}
									placeholder="Customer name"
									value={customerName}
								/>
							</div>
							<div>
								<label
									className="mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wider"
									htmlFor="customer-phone"
								>
									Phone
								</label>
								<Input
									className="h-12 rounded-xl bg-secondary px-4 text-base"
									id="customer-phone"
									onChange={(event) => setCustomerPhone(event.target.value)}
									placeholder="9876543210"
									required
									type="tel"
									value={customerPhone}
								/>
							</div>
						</div>

						<div>
							<label
								className="mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wider"
								htmlFor="vehicle-type"
							>
								Vehicle type
							</label>
							<Input
								className="h-12 rounded-xl bg-secondary px-4 text-base"
								id="vehicle-type"
								onChange={(event) => setVehicleType(event.target.value)}
								placeholder="Car, Bike, etc."
								value={vehicleType}
							/>
						</div>

						<Button
							className="mt-1 h-14 rounded-xl font-semibold text-base"
							disabled={
								createEntryMutation.isPending ||
								!selectedLotId ||
								!selectedGateId ||
								!plateNumber.trim() ||
								!customerPhone.trim()
							}
							onClick={() => createEntryMutation.mutate()}
							size="lg"
							type="button"
						>
							{createEntryMutation.isPending
								? "Creating entry..."
								: "Create entry"}
						</Button>

						{mode === "entry" && lookupResult && (
							<Button
								className="h-10 rounded-xl"
								onClick={resetForm}
								type="button"
								variant="ghost"
							>
								Clear & start over
							</Button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
