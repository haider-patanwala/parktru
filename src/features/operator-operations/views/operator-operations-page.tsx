"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
	normalizePlateNumber,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	ApiResult,
	OperatorContext,
	PlateLookupResult,
	ReceiptPreview,
	SessionLists,
	SessionSnapshot,
} from "@/features/operator-operations/models/operator-operations.types";
import { cn } from "@/lib/utils";
import { authClient } from "@/server/better-auth/client";
import { eden } from "@/server/eden";

function extractErrorMessage(error: unknown) {
	if (error instanceof Error) {
		const edenError = error as Error & {
			status?: number;
			value?: unknown;
		};
		const errorValue = edenError.value;

		if (
			errorValue &&
			typeof errorValue === "object" &&
			"message" in errorValue &&
			typeof errorValue.message === "string" &&
			errorValue.message.length > 0
		) {
			return errorValue.message;
		}

		if (typeof edenError.status === "number" && edenError.message) {
			return `Request failed (${edenError.status}): ${edenError.message}`;
		}

		if (error.message) {
			return error.message;
		}
	}

	return "The request failed.";
}

function unwrap<T>(result: {
	data: ApiResult<T> | null;
	error: unknown | null;
}) {
	if (result.data?.success) {
		return result.data.data;
	}

	if (result.data && !result.data.success) {
		throw new Error(result.data.message);
	}

	throw new Error(extractErrorMessage(result.error));
}

function parseRequiredText(
	value: string,
	fieldLabel: string,
	minimumLength = 1,
) {
	const normalized = value.trim();

	if (normalized.length < minimumLength) {
		throw new Error(
			`${fieldLabel} must be at least ${minimumLength} characters long.`,
		);
	}

	return normalized;
}

function parseNonNegativeNumber(value: string, fieldLabel: string) {
	const parsed = Number(value);

	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new Error(
			`${fieldLabel} must be a valid number greater than or equal to 0.`,
		);
	}

	return parsed;
}

const inputClassName = "h-12 rounded-[1.15rem] px-4";
const tallInputClassName = "h-14 rounded-[1.4rem] px-5 text-base";
const shellCardClassName =
	"rounded-[2rem] border border-border/80 bg-card/95 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm";
const panelCardClassName =
	"rounded-[1.75rem] border border-border/80 bg-card/96 shadow-[0_18px_50px_rgba(15,23,42,0.06)]";
const fieldLabelClassName =
	"mb-2 block font-medium text-muted-foreground text-sm";
const sectionEyebrowClassName =
	"font-medium text-[0.72rem] text-muted-foreground uppercase tracking-[0.22em]";

function SessionCard({
	onSelect,
	session,
}: {
	onSelect?: ((session: SessionSnapshot) => void) | undefined;
	session: SessionSnapshot;
}) {
	return (
		<button
			className="flex w-full flex-col gap-3 rounded-[1.5rem] border border-border/80 bg-background px-4 py-4 text-left transition hover:bg-muted/40"
			onClick={() => onSelect?.(session)}
			type="button"
		>
			<div className="flex items-center justify-between gap-4">
				<div>
					<p className="font-semibold text-base text-foreground">
						{session.displayPlateNumber}
					</p>
					<p className="text-muted-foreground text-sm">
						{session.parkingLotName}
					</p>
				</div>
				<Badge variant={session.status === "active" ? "secondary" : "outline"}>
					{session.status}
				</Badge>
			</div>
			<div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm">
				<span>{session.customerName || "No customer name"}</span>
				<span>{session.customerPhone || "No phone recorded"}</span>
				<span>
					{session.exitAt
						? formatDuration(session.entryAt, session.exitAt)
						: `Entered ${formatDateTime(session.entryAt)}`}
				</span>
			</div>
		</button>
	);
}

export function OperatorOperationsPage() {
	const queryClient = useQueryClient();
	const sessionState = authClient.useSession();
	const [isSignUpMode, setIsSignUpMode] = useState(false);
	const [authName, setAuthName] = useState("");
	const [authEmail, setAuthEmail] = useState("");
	const [authPassword, setAuthPassword] = useState("");
	const [authError, setAuthError] = useState<string | null>(null);
	const [tenantName, setTenantName] = useState("");
	const [initialLotName, setInitialLotName] = useState("");
	const [initialBaseRate, setInitialBaseRate] = useState("50");
	const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
	const [currentBaseRate, setCurrentBaseRate] = useState("0");
	const [plateNumber, setPlateNumber] = useState("");
	const [customerName, setCustomerName] = useState("");
	const [customerPhone, setCustomerPhone] = useState("");
	const [vehicleType, setVehicleType] = useState("");
	const [lookupResult, setLookupResult] = useState<PlateLookupResult | null>(
		null,
	);
	const [activeMode, setActiveMode] = useState<"entry" | "exit" | "duplicate">(
		"entry",
	);
	const [entryTimeDraft, setEntryTimeDraft] = useState("");
	const [finalAmount, setFinalAmount] = useState("0");
	const [overrideAmount, setOverrideAmount] = useState("");
	const [receiptPreview, setReceiptPreview] = useState<ReceiptPreview | null>(
		null,
	);
	const [receiptSessionId, setReceiptSessionId] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [isOnline, setIsOnline] = useState(true);
	const [browserOrigin, setBrowserOrigin] = useState("");

	const operatorContextQuery = useQuery({
		enabled: Boolean(sessionState.data?.session),
		queryKey: ["operator-context", sessionState.data?.user?.id],
		queryFn: async () =>
			unwrap<OperatorContext>(await eden.operator.context.get()),
	});

	const operatorContext = operatorContextQuery.data ?? null;

	useEffect(() => {
		if (operatorContext?.selectedParkingLotId) {
			setSelectedLotId(operatorContext.selectedParkingLotId);
		}
	}, [operatorContext?.selectedParkingLotId]);

	useEffect(() => {
		const lot = operatorContext?.allowedLots.find(
			(value) => value.id === selectedLotId,
		);

		if (lot) {
			setCurrentBaseRate(String(lot.baseRate));
		}
	}, [operatorContext?.allowedLots, selectedLotId]);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const syncOnlineState = () => setIsOnline(window.navigator.onLine);

		setBrowserOrigin(window.location.origin);
		syncOnlineState();
		window.addEventListener("online", syncOnlineState);
		window.addEventListener("offline", syncOnlineState);

		return () => {
			window.removeEventListener("online", syncOnlineState);
			window.removeEventListener("offline", syncOnlineState);
		};
	}, []);

	const sessionsQuery = useQuery({
		enabled: Boolean(selectedLotId && operatorContext?.workspaceReady),
		queryKey: ["operator-sessions", selectedLotId],
		queryFn: async () =>
			unwrap<SessionLists>(
				await eden.operator.sessions.get({
					query: { parkingLotId: selectedLotId ?? undefined },
				}),
			),
	});

	const authMutation = useMutation({
		mutationFn: async () => {
			setAuthError(null);

			if (isSignUpMode) {
				await authClient.signUp.email({
					email: authEmail,
					name: authName,
					password: authPassword,
				});
			} else {
				await authClient.signIn.email({
					email: authEmail,
					password: authPassword,
				});
			}

			await sessionState.refetch();
		},
		onError: (error) => {
			setAuthError(
				error instanceof Error ? error.message : "Authentication failed.",
			);
		},
	});

	const bootstrapMutation = useMutation({
		mutationFn: async () =>
			unwrap<OperatorContext>(
				await eden.operator.bootstrap.post({
					baseRate: parseNonNegativeNumber(initialBaseRate, "Base rate"),
					initialLotName: parseRequiredText(
						initialLotName,
						"First parking lot",
						2,
					),
					tenantName: parseRequiredText(
						tenantName,
						"Tenant or organization name",
						2,
					),
				}),
			),
		onError: (error) => {
			setActionError(extractErrorMessage(error));
		},
		onSuccess: async () => {
			setActionError(null);
			await queryClient.invalidateQueries({ queryKey: ["operator-context"] });
		},
	});

	const selectLotMutation = useMutation({
		mutationFn: async (parkingLotId: string) =>
			unwrap<OperatorContext>(
				await eden.operator["select-lot"].post({ parkingLotId }),
			),
		onError: (error) => {
			setActionError(
				error instanceof Error ? error.message : "Lot switch failed.",
			);
		},
		onSuccess: async (context) => {
			setActionError(null);
			setSelectedLotId(context.selectedParkingLotId);
			setLookupResult(null);
			setReceiptPreview(null);
			await queryClient.invalidateQueries({ queryKey: ["operator-context"] });
			await queryClient.invalidateQueries({ queryKey: ["operator-sessions"] });
		},
	});

	const lookupMutation = useMutation({
		mutationFn: async () =>
			unwrap<PlateLookupResult>(
				await eden.operator.lookup.plate.post({
					plateNumber,
				}),
			),
		onError: (error) => {
			setActionError(
				error instanceof Error ? error.message : "Plate lookup failed.",
			);
		},
		onSuccess: (result) => {
			setActionError(null);
			setLookupResult(result);
			setReceiptPreview(null);
			setPlateNumber(result.normalizedPlateNumber);
			setCustomerName(result.customerDefaults?.customerName ?? "");
			setCustomerPhone(result.customerDefaults?.customerPhone ?? "");

			if (result.activeSession) {
				setActiveMode("duplicate");
				setEntryTimeDraft(result.activeSession.entryAt.slice(0, 16));
				setFinalAmount(String(result.activeSession.baseRateSnapshot));
				setOverrideAmount(
					result.activeSession.overrideAmount
						? String(result.activeSession.overrideAmount)
						: "",
				);
				return;
			}

			setActiveMode("entry");
			setFinalAmount(currentBaseRate || "0");
			setOverrideAmount("");
		},
	});

	const createEntryMutation = useMutation({
		mutationFn: async () =>
			unwrap<{ created: boolean; duplicateSession: SessionSnapshot | null }>(
				await eden.operator.entry.post({
					customerName,
					customerPhone,
					displayPlateNumber: plateNumber,
					parkingLotId: selectedLotId ?? "",
					vehicleType,
				}),
			),
		onError: (error) => {
			setActionError(
				error instanceof Error ? error.message : "Entry creation failed.",
			);
		},
		onSuccess: async (result) => {
			if (!result.created && result.duplicateSession) {
				setLookupResult({
					activeSession: result.duplicateSession,
					customerDefaults: {
						customerName,
						customerPhone,
					},
					normalizedPlateNumber: normalizePlateNumber(plateNumber),
					recentMatches: [result.duplicateSession],
				});
				setActiveMode("duplicate");
				setEntryTimeDraft(result.duplicateSession.entryAt.slice(0, 16));
				return;
			}

			setActionError(null);
			setLookupResult(null);
			setPlateNumber("");
			setCustomerName("");
			setCustomerPhone("");
			setVehicleType("");
			setReceiptSessionId(null);
			await queryClient.invalidateQueries({ queryKey: ["operator-sessions"] });
		},
	});

	const updateEntryTimeMutation = useMutation({
		mutationFn: async () =>
			unwrap<boolean>(
				await eden.operator["entry-time"].post({
					entryAt: new Date(entryTimeDraft).toISOString(),
					parkingSessionId: lookupResult?.activeSession?.id ?? "",
				}),
			),
		onError: (error) => {
			setActionError(
				error instanceof Error ? error.message : "Entry correction failed.",
			);
		},
		onSuccess: async () => {
			setActionError(null);
			await queryClient.invalidateQueries({ queryKey: ["operator-sessions"] });
			const freshLookup = await lookupMutation.mutateAsync();
			setLookupResult(freshLookup);
			setEntryTimeDraft(freshLookup.activeSession?.entryAt.slice(0, 16) ?? "");
		},
	});

	const setLotRateMutation = useMutation({
		mutationFn: async () =>
			unwrap<boolean>(
				await eden.operator["lot-rate"].post({
					baseRate: parseNonNegativeNumber(currentBaseRate, "Base rate"),
					parkingLotId: selectedLotId ?? "",
				}),
			),
		onError: (error) => {
			setActionError(extractErrorMessage(error));
		},
		onSuccess: async () => {
			setActionError(null);
			await queryClient.invalidateQueries({ queryKey: ["operator-context"] });
		},
	});

	const closeExitMutation = useMutation({
		mutationFn: async () =>
			unwrap<{
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
					finalAmount: parseNonNegativeNumber(finalAmount, "Final amount"),
					overrideAmount: overrideAmount
						? parseNonNegativeNumber(overrideAmount, "Override amount")
						: undefined,
					parkingSessionId: lookupResult?.activeSession?.id ?? "",
				}),
			),
		onError: (error) => {
			setActionError(extractErrorMessage(error));
		},
		onSuccess: async (closed) => {
			setActionError(null);
			setReceiptSessionId(lookupResult?.activeSession?.id ?? null);
			setReceiptPreview({
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
			});
			setLookupResult(null);
			setPlateNumber(closed.plateNumber);
			await queryClient.invalidateQueries({ queryKey: ["operator-sessions"] });
		},
	});

	const shareReceiptMutation = useMutation({
		mutationFn: async () =>
			unwrap<ReceiptPreview>(
				await eden.operator.receipt.link.post({
					parkingSessionId: receiptSessionId ?? "",
				}),
			),
		onError: (error) => {
			setActionError(
				error instanceof Error ? error.message : "Receipt share failed.",
			);
		},
		onSuccess: async (preview) => {
			setActionError(null);
			setReceiptPreview(preview);
			const shareUrl = `${window.location.origin}${preview.sharePath}`;

			if (typeof navigator !== "undefined" && navigator.share) {
				await navigator.share({
					text: `Receipt ${preview.receiptNumber} for ${preview.plateNumber}`,
					title: `${preview.tenantName} receipt`,
					url: shareUrl,
				});
				return;
			}

			if (typeof navigator !== "undefined" && navigator.clipboard) {
				await navigator.clipboard.writeText(shareUrl);
			}
		},
	});

	const logoutMutation = useMutation({
		mutationFn: async () => {
			await authClient.signOut();
			await sessionState.refetch();
		},
	});

	const activeLot =
		operatorContext?.allowedLots.find((lot) => lot.id === selectedLotId) ??
		null;
	const activeSession = lookupResult?.activeSession ?? null;

	const hydrateFromSession = (session: SessionSnapshot) => {
		setPlateNumber(session.displayPlateNumber);
		setCustomerName(session.customerName);
		setCustomerPhone(session.customerPhone);
		setReceiptPreview(null);

		if (session.status === "active") {
			setLookupResult({
				activeSession: session,
				customerDefaults: {
					customerName: session.customerName,
					customerPhone: session.customerPhone,
				},
				normalizedPlateNumber: normalizePlateNumber(session.displayPlateNumber),
				recentMatches: [session],
			});
			setActiveMode("duplicate");
			setEntryTimeDraft(session.entryAt.slice(0, 16));
			setFinalAmount(
				String(session.overrideAmount ?? session.baseRateSnapshot),
			);
			setOverrideAmount(
				session.overrideAmount ? String(session.overrideAmount) : "",
			);
			return;
		}

		setLookupResult({
			activeSession: null,
			customerDefaults: {
				customerName: session.customerName,
				customerPhone: session.customerPhone,
			},
			normalizedPlateNumber: normalizePlateNumber(session.displayPlateNumber),
			recentMatches: [session],
		});
		setActiveMode("entry");
	};

	if (sessionState.isPending) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(36,110,98,0.16),_transparent_36%),linear-gradient(to_bottom,_#f4faf8,_#ffffff)] px-6 py-16">
				<Card className={cn(shellCardClassName, "w-full max-w-sm")}>
					<CardContent className="pt-6">
						<p className="font-medium text-muted-foreground">
						Loading operator workspace…
						</p>
					</CardContent>
				</Card>
			</main>
		);
	}

	if (!sessionState.data?.session) {
		return (
			<main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(36,110,98,0.14),_transparent_38%),linear-gradient(to_bottom,_#f2faf8,_#ffffff)] px-4 py-10 text-foreground sm:px-6">
				<section className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
					<Card className="rounded-[2rem] border-0 bg-neutral-950 px-1 py-1 text-white shadow-[0_32px_90px_rgba(15,23,42,0.22)]">
						<CardContent className="px-6 py-8 sm:px-8 sm:py-10">
							<p className="font-medium text-[0.72rem] text-white/60 uppercase tracking-[0.24em]">
							ParkTru operator
							</p>
							<h1 className="mt-5 max-w-lg font-semibold text-4xl leading-tight sm:text-5xl">
								Handle lot entry and exit from one quiet workspace.
							</h1>
							<p className="mt-5 max-w-xl text-base text-white/72 sm:text-lg">
								Real auth, lot-aware operator context, duplicate-session
								recovery, fast entry and exit, and receipt preview with
								share-link handoff.
							</p>
						</CardContent>
					</Card>

					<Card className={shellCardClassName}>
						<CardHeader className="flex-row items-start justify-between gap-4">
							<div>
								<p className={sectionEyebrowClassName}>
									{isSignUpMode
										? "Create operator account"
										: "Operator sign in"}
								</p>
								<CardTitle className="mt-2 text-2xl">
									{isSignUpMode ? "Start your workspace" : "Welcome back"}
								</CardTitle>
							</div>
							<Button
								onClick={() => setIsSignUpMode((value) => !value)}
								size="sm"
								variant="outline"
							>
								{isSignUpMode ? "Use sign in" : "Create account"}
							</Button>
						</CardHeader>

						<form
							className="flex flex-col gap-4 px-6 pb-6"
							onSubmit={(event) => {
								event.preventDefault();
								authMutation.mutate();
							}}
						>
							{isSignUpMode ? (
								<Input
									autoComplete="name"
									className={inputClassName}
									onChange={(event) => setAuthName(event.target.value)}
									placeholder="Operator name"
									required
									value={authName}
								/>
							) : null}
							<Input
								autoComplete="email"
								className={inputClassName}
								onChange={(event) => setAuthEmail(event.target.value)}
								placeholder="name@company.com"
								required
								type="email"
								value={authEmail}
							/>
							<Input
								autoComplete={
									isSignUpMode ? "new-password" : "current-password"
								}
								className={inputClassName}
								onChange={(event) => setAuthPassword(event.target.value)}
								placeholder="Password"
								required
								type="password"
								value={authPassword}
							/>

							{authError ? (
								<p className="rounded-[1.15rem] bg-rose-50 px-4 py-3 text-rose-700 text-sm">
									{authError}
								</p>
							) : null}

							<Button
								className="h-12 rounded-[1.2rem]"
								disabled={authMutation.isPending}
								size="lg"
								type="submit"
							>
								{authMutation.isPending
									? "Working…"
									: isSignUpMode
										? "Create account"
										: "Sign in"}
							</Button>
						</form>
					</Card>
				</section>
			</main>
		);
	}

	if (operatorContextQuery.isPending) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(36,110,98,0.16),_transparent_36%),linear-gradient(to_bottom,_#f4faf8,_#ffffff)] px-6 py-16">
				<Card className={cn(shellCardClassName, "w-full max-w-sm")}>
					<CardContent className="pt-6">
						<p className="font-medium text-muted-foreground">
						Loading operator context…
						</p>
					</CardContent>
				</Card>
			</main>
		);
	}

	if (!operatorContext?.workspaceReady) {
		return (
			<main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(36,110,98,0.12),_transparent_36%),linear-gradient(to_bottom,_#f4faf8,_#ffffff)] px-4 py-10 text-foreground sm:px-6">
				<section className="mx-auto w-full max-w-3xl">
					<Card className={shellCardClassName}>
						<CardHeader className="flex-row items-start justify-between gap-4">
							<div>
								<p className={sectionEyebrowClassName}>
									Workspace setup
								</p>
								<CardTitle className="mt-2 text-3xl">
									Create your first lot
								</CardTitle>
								<CardDescription className="mt-3 max-w-2xl text-base">
									You are signed in. Create the tenant workspace and first
									parking lot before operators start using the gate flow.
								</CardDescription>
							</div>
							<Button
								onClick={() => logoutMutation.mutate()}
								size="sm"
								variant="outline"
							>
								Log out
							</Button>
						</CardHeader>

						<form
							className="grid gap-4 px-6 pb-6 sm:grid-cols-2"
							onSubmit={(event) => {
								event.preventDefault();
								bootstrapMutation.mutate();
							}}
						>
							<div className="sm:col-span-2">
								<label className={fieldLabelClassName} htmlFor="tenant-name">
									Tenant or organization name
								</label>
								<Input
									className={inputClassName}
									id="tenant-name"
									minLength={2}
									onChange={(event) => setTenantName(event.target.value)}
									placeholder="Downtown Parking Operations"
									required
									value={tenantName}
								/>
							</div>
							<div>
								<label className={fieldLabelClassName} htmlFor="lot-name">
									First parking lot
								</label>
								<Input
									className={inputClassName}
									id="lot-name"
									minLength={2}
									onChange={(event) => setInitialLotName(event.target.value)}
									placeholder="North Gate"
									required
									value={initialLotName}
								/>
							</div>
							<div>
								<label className={fieldLabelClassName} htmlFor="base-rate">
									Base rate
								</label>
								<Input
									className={inputClassName}
									id="base-rate"
									min="0"
									onChange={(event) => setInitialBaseRate(event.target.value)}
									required
									step="1"
									type="number"
									value={initialBaseRate}
								/>
							</div>

							{actionError ? (
								<p className="rounded-[1.15rem] bg-rose-50 px-4 py-3 text-rose-700 text-sm sm:col-span-2">
									{actionError}
								</p>
							) : null}

							<div className="flex justify-end sm:col-span-2">
								<Button
									className="h-12 rounded-[1.2rem]"
									disabled={bootstrapMutation.isPending}
									size="lg"
									type="submit"
								>
									{bootstrapMutation.isPending
										? "Creating workspace…"
										: "Create workspace"}
								</Button>
							</div>
						</form>
					</Card>
				</section>
			</main>
		);
	}

	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(36,110,98,0.14),_transparent_30%),linear-gradient(to_bottom,_#eef8f6,_#ffffff)] px-4 py-6 text-foreground sm:px-6 sm:py-8">
			<section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
				<Card
					className={cn(shellCardClassName, "sticky top-4 z-10 overflow-visible")}
				>
					<CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div>
							<p className={sectionEyebrowClassName}>
								{operatorContext.tenant?.name}
							</p>
							<CardTitle className="mt-2 text-3xl">
								Operator gate flow
							</CardTitle>
							<CardDescription className="mt-2 max-w-2xl text-base">
								One workspace for fast entry, exit, duplicate recovery, and
								receipt handoff.
							</CardDescription>
						</div>

						<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
							<Select
								disabled={selectLotMutation.isPending}
								onValueChange={(value) => {
									if (!value) {
										return;
									}

									setSelectedLotId(value);
									selectLotMutation.mutate(value);
								}}
								value={selectedLotId ?? null}
							>
								<SelectTrigger
									className="h-12 min-w-[14rem] rounded-[1.3rem] px-4"
									size="default"
								>
									<SelectValue placeholder="Select parking lot" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{operatorContext.allowedLots.map((lot) => (
											<SelectItem key={lot.id} value={lot.id}>
												{lot.name}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>

							<Badge variant={isOnline ? "secondary" : "outline"}>
								{isOnline ? "Online" : "Offline"}
							</Badge>

							<Button
								className="h-12 rounded-[1.3rem]"
								onClick={() => logoutMutation.mutate()}
								size="lg"
								variant="outline"
							>
								Log out
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						<div className="grid gap-3 md:grid-cols-3">
							<div className="rounded-[1.4rem] bg-muted/45 px-4 py-4">
								<p className={sectionEyebrowClassName}>Active lot</p>
								<p className="mt-2 font-semibold text-lg">
									{activeLot?.name ?? "No lot selected"}
								</p>
								<p className="mt-1 text-muted-foreground text-sm">
									{activeLot?.code ?? "Select a lot to continue"}
								</p>
							</div>
							<div className="rounded-[1.4rem] bg-muted/45 px-4 py-4">
								<p className={sectionEyebrowClassName}>Active vehicles</p>
								<p className="mt-2 font-semibold text-2xl">
									{sessionsQuery.data?.activeSessions.length ?? 0}
								</p>
								<p className="mt-1 text-muted-foreground text-sm">
									Currently inside this lot
								</p>
							</div>
							<div className="rounded-[1.4rem] bg-muted/45 px-4 py-4">
								<p className={sectionEyebrowClassName}>Receipt status</p>
								<p className="mt-2 font-semibold text-lg">
									{receiptPreview ? "Ready to share" : "Waiting for exit"}
								</p>
								<p className="mt-1 text-muted-foreground text-sm">
									Preview before skip or share
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{actionError ? (
					<Card className="rounded-[1.5rem] border-rose-200 bg-rose-50/80 shadow-none">
						<CardContent className="pt-6">
							<p className="text-rose-700 text-sm">{actionError}</p>
						</CardContent>
					</Card>
				) : null}

				<div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
					<Card className={cn(shellCardClassName, "overflow-visible")}>
						<CardHeader>
							<p className={sectionEyebrowClassName}>Gate workspace</p>
							<CardTitle className="text-2xl">
								Search, enter, and exit from one screen
							</CardTitle>
							<CardDescription className="text-base">
								Keep the plate input hot, switch lots without leaving the
								workspace, and recover duplicates without restarting the flow.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-6">
							<div className="rounded-[1.6rem] bg-muted/45 p-4 sm:p-5">
								<div className="flex flex-col gap-3 sm:flex-row">
									<Input
										className={cn(tallInputClassName, "sm:flex-1")}
										onChange={(event) => setPlateNumber(event.target.value)}
										placeholder="Enter plate number"
										value={plateNumber}
									/>
									<div className="grid gap-3 sm:grid-cols-2">
										<Button
											className="h-14 rounded-[1.4rem]"
											disabled={!plateNumber || lookupMutation.isPending}
											onClick={() => lookupMutation.mutate()}
											size="lg"
											type="button"
										>
											{lookupMutation.isPending
												? "Looking up…"
												: "Find session"}
										</Button>
										<Button
											className="h-14 rounded-[1.4rem]"
											disabled
											size="lg"
											type="button"
											variant="outline"
										>
											OCR coming soon
										</Button>
									</div>
								</div>
							</div>

							{lookupResult?.activeSession && activeMode === "duplicate" ? (
								<Card className={panelCardClassName} size="sm">
									<CardHeader>
										<div className="flex items-center justify-between gap-3">
											<div>
												<p className={sectionEyebrowClassName}>
													Duplicate warning
												</p>
												<CardTitle className="mt-2 text-2xl">
													{lookupResult.activeSession.displayPlateNumber}
												</CardTitle>
											</div>
											<Badge variant="outline">Active session</Badge>
										</div>
										<CardDescription className="text-base">
											Entered at{" "}
											{formatDateTime(lookupResult.activeSession.entryAt)} in{" "}
											{lookupResult.activeSession.parkingLotName}.
										</CardDescription>
									</CardHeader>
									<CardContent className="flex flex-col gap-4">
										<div>
											<label
												className={fieldLabelClassName}
												htmlFor="entry-time-draft"
											>
												Correct entry time
											</label>
											<Input
												className={inputClassName}
												id="entry-time-draft"
												onChange={(event) =>
													setEntryTimeDraft(event.target.value)
												}
												type="datetime-local"
												value={entryTimeDraft}
											/>
										</div>
									</CardContent>
									<CardFooter className="flex flex-wrap gap-3">
										<Button
											className="h-12 rounded-[1.2rem]"
											onClick={() => {
												setActiveMode("exit");
												setFinalAmount(
													String(
														lookupResult.activeSession?.overrideAmount ??
															activeLot?.baseRate ??
															lookupResult.activeSession?.baseRateSnapshot ??
															0,
													),
												);
											}}
											type="button"
										>
											Suggest exit
										</Button>
										<Button
											className="h-12 rounded-[1.2rem]"
											onClick={() => updateEntryTimeMutation.mutate()}
											type="button"
											variant="outline"
										>
											{updateEntryTimeMutation.isPending
												? "Saving…"
												: "Save entry time"}
										</Button>
										<Button
											className="h-12 rounded-[1.2rem]"
											onClick={() => setActiveMode("entry")}
											type="button"
											variant="ghost"
										>
											Return to review
										</Button>
									</CardFooter>
								</Card>
							) : null}

							<div className="grid gap-4 md:grid-cols-2">
								<div className="md:col-span-2">
									<label className={fieldLabelClassName} htmlFor="plate-display">
										Plate number
									</label>
									<Input
										className={inputClassName}
										id="plate-display"
										onChange={(event) => setPlateNumber(event.target.value)}
										placeholder="MH12AB1234"
										value={plateNumber}
									/>
								</div>
								<div>
									<label className={fieldLabelClassName} htmlFor="customer-name">
										Customer name
									</label>
									<Input
										className={inputClassName}
										id="customer-name"
										onChange={(event) => setCustomerName(event.target.value)}
										placeholder="Customer name"
										value={customerName}
									/>
								</div>
								<div>
									<label className={fieldLabelClassName} htmlFor="customer-phone">
										Customer phone
									</label>
									<Input
										className={inputClassName}
										id="customer-phone"
										onChange={(event) => setCustomerPhone(event.target.value)}
										placeholder="Customer phone"
										required
										type="tel"
										value={customerPhone}
									/>
								</div>
								<div className="md:col-span-2">
									<label className={fieldLabelClassName} htmlFor="vehicle-type">
										Vehicle type
									</label>
									<Input
										className={inputClassName}
										id="vehicle-type"
										onChange={(event) => setVehicleType(event.target.value)}
										placeholder="Optional vehicle type"
										value={vehicleType}
									/>
								</div>
							</div>

							<Separator />

							{activeSession && activeMode === "exit" ? (
								<Card className={panelCardClassName} size="sm">
									<CardHeader>
										<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
											<div>
												<p className={sectionEyebrowClassName}>Exit review</p>
												<CardTitle className="mt-2 text-2xl">
													{activeSession.displayPlateNumber}
												</CardTitle>
												<CardDescription className="mt-2 text-base">
													Open for{" "}
													{formatDuration(activeSession.entryAt, new Date())}
												</CardDescription>
											</div>
											<Badge variant="secondary">
												{formatCurrency(
													activeLot?.baseRate ?? activeSession.baseRateSnapshot,
												)}
											</Badge>
										</div>
									</CardHeader>
									<CardContent className="flex flex-col gap-5">
										<div className="grid gap-3 sm:grid-cols-3">
											<div className="rounded-[1.2rem] bg-muted/45 px-4 py-3">
												<p className={sectionEyebrowClassName}>Entered</p>
												<p className="mt-2 text-sm">
													{formatDateTime(activeSession.entryAt)}
												</p>
											</div>
											<div className="rounded-[1.2rem] bg-muted/45 px-4 py-3">
												<p className={sectionEyebrowClassName}>Customer</p>
												<p className="mt-2 text-sm">
													{activeSession.customerPhone || "Phone missing"}
												</p>
											</div>
											<div className="rounded-[1.2rem] bg-muted/45 px-4 py-3">
												<p className={sectionEyebrowClassName}>Lot</p>
												<p className="mt-2 text-sm">
													{activeSession.parkingLotName}
												</p>
											</div>
										</div>

										<div className="grid gap-4 md:grid-cols-2">
											<div>
												<label
													className={fieldLabelClassName}
													htmlFor="final-amount"
												>
													Final amount
												</label>
												<Input
													className={inputClassName}
													id="final-amount"
													min="0"
													onChange={(event) =>
														setFinalAmount(event.target.value)
													}
													step="1"
													type="number"
													value={finalAmount}
												/>
											</div>
											<div>
												<label
													className={fieldLabelClassName}
													htmlFor="override-amount"
												>
													Manual override
												</label>
												<Input
													className={inputClassName}
													id="override-amount"
													min="0"
													onChange={(event) =>
														setOverrideAmount(event.target.value)
													}
													placeholder="Optional override"
													step="1"
													type="number"
													value={overrideAmount}
												/>
											</div>
										</div>
									</CardContent>
									<CardFooter className="flex flex-wrap gap-3">
										<Button
											className="h-12 rounded-[1.2rem]"
											disabled={closeExitMutation.isPending}
											onClick={() => closeExitMutation.mutate()}
											type="button"
										>
											{closeExitMutation.isPending
												? "Closing exit…"
												: "Close exit"}
										</Button>
										<Button
											className="h-12 rounded-[1.2rem]"
											onClick={() => setActiveMode("duplicate")}
											type="button"
											variant="outline"
										>
											Back to warning
										</Button>
									</CardFooter>
								</Card>
							) : (
								<Card className={panelCardClassName} size="sm">
									<CardHeader>
										<p className={sectionEyebrowClassName}>Entry workflow</p>
										<CardTitle className="text-2xl">
											Create a new parking entry
										</CardTitle>
										<CardDescription className="text-base">
											Phone number is required. Customer and vehicle details
											will be reused when the plate already has recent history.
										</CardDescription>
									</CardHeader>
									<CardFooter>
										<Button
											className="h-12 rounded-[1.2rem]"
											disabled={
												createEntryMutation.isPending ||
												!selectedLotId ||
												!plateNumber ||
												!customerPhone
											}
											onClick={() => createEntryMutation.mutate()}
											size="lg"
											type="button"
										>
											{createEntryMutation.isPending
												? "Creating entry…"
												: "Create entry"}
										</Button>
									</CardFooter>
								</Card>
							)}
						</CardContent>
					</Card>

					<aside className="flex flex-col gap-6">
						<Card className={shellCardClassName}>
							<CardHeader>
								<div className="flex items-start justify-between gap-4">
									<div>
										<p className={sectionEyebrowClassName}>Selected lot</p>
										<CardTitle className="mt-2 text-2xl">
											{activeLot?.name ?? "No lot selected"}
										</CardTitle>
										<CardDescription className="mt-1 text-base">
											{activeLot?.code ?? "Select a lot to continue"}
										</CardDescription>
									</div>
									<Badge variant="outline">
										{activeLot?.status ?? "inactive"}
									</Badge>
								</div>
							</CardHeader>
							<CardContent>
								<div className="flex gap-3">
									<Input
										className={inputClassName}
										min="0"
										onChange={(event) =>
											setCurrentBaseRate(event.target.value)
										}
										step="1"
										type="number"
										value={currentBaseRate}
									/>
									<Button
										className="h-12 rounded-[1.2rem]"
										disabled={!selectedLotId || setLotRateMutation.isPending}
										onClick={() => setLotRateMutation.mutate()}
										type="button"
										variant="outline"
									>
										Save rate
									</Button>
								</div>
							</CardContent>
						</Card>

						<Card className={shellCardClassName}>
							<CardHeader>
								<p className={sectionEyebrowClassName}>Active sessions</p>
								<CardTitle className="text-xl">
									Vehicles currently in this lot
								</CardTitle>
							</CardHeader>
							<CardContent className="flex flex-col gap-3">
								{sessionsQuery.data?.activeSessions.length ? (
									sessionsQuery.data.activeSessions.map((session) => (
										<SessionCard
											key={session.id}
											onSelect={hydrateFromSession}
											session={session}
										/>
									))
								) : (
									<div className="rounded-[1.5rem] border border-dashed border-border px-4 py-6 text-muted-foreground text-sm">
										No active vehicles in this lot right now.
									</div>
								)}
							</CardContent>
						</Card>

						<Card className={shellCardClassName}>
							<CardHeader>
								<p className={sectionEyebrowClassName}>Recent sessions</p>
								<CardTitle className="text-xl">
									Quick recovery for recent vehicles
								</CardTitle>
							</CardHeader>
							<CardContent className="flex flex-col gap-3">
								{sessionsQuery.data?.recentSessions.length ? (
									sessionsQuery.data.recentSessions.map((session) => (
										<SessionCard
											key={session.id}
											onSelect={hydrateFromSession}
											session={session}
										/>
									))
								) : (
									<div className="rounded-[1.5rem] border border-dashed border-border px-4 py-6 text-muted-foreground text-sm">
										No recent closed sessions yet.
									</div>
								)}
							</CardContent>
						</Card>

						<Card className={shellCardClassName}>
							<CardHeader>
								<p className={sectionEyebrowClassName}>Receipt preview</p>
								<CardTitle className="text-xl">
									Preview before sharing
								</CardTitle>
								<CardDescription>
									Share a generated link or skip the receipt after reviewing it.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{receiptPreview ? (
									<div className="flex flex-col gap-4 rounded-[1.6rem] bg-muted/45 p-5">
										<div className="flex items-center justify-between gap-4">
											<div>
												<p className="font-semibold text-lg">
													{receiptPreview.plateNumber}
												</p>
												<p className="text-muted-foreground text-sm">
													{receiptPreview.customerName ||
														"Customer not recorded"}
												</p>
											</div>
											<p className="font-semibold text-xl">
												{formatCurrency(receiptPreview.amount)}
											</p>
										</div>
										<Separator />
										<div className="grid gap-2 text-muted-foreground text-sm">
											<p>Entry: {formatDateTime(receiptPreview.entryAt)}</p>
											<p>Exit: {formatDateTime(receiptPreview.exitAt)}</p>
											<p>Lot: {receiptPreview.parkingLotName}</p>
										</div>
										<div className="flex flex-wrap gap-3">
											<Button
												className="h-12 rounded-[1.2rem]"
												disabled={shareReceiptMutation.isPending}
												onClick={() => shareReceiptMutation.mutate()}
												type="button"
											>
												{shareReceiptMutation.isPending
													? "Sharing…"
													: "Share receipt link"}
											</Button>
											<Button
												className="h-12 rounded-[1.2rem]"
												onClick={() => setReceiptPreview(null)}
												type="button"
												variant="outline"
											>
												Skip receipt
											</Button>
										</div>
										{receiptPreview.sharePath ? (
											<div className="rounded-[1.2rem] bg-background px-4 py-3 text-muted-foreground text-xs">
												{browserOrigin}
												{receiptPreview.sharePath}
											</div>
										) : null}
									</div>
								) : (
									<div className="rounded-[1.5rem] border border-dashed border-border px-4 py-6 text-muted-foreground text-sm">
										Close an exit to preview the receipt before you skip it or
										share the generated link.
									</div>
								)}
							</CardContent>
						</Card>
					</aside>
				</div>
			</section>
		</main>
	);
}
