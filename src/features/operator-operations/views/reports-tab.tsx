"use client";

import {
	Analytics01Icon,
	Call02Icon,
	Car03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	formatCurrency,
	formatDateTime,
	type MoneyFormatOptions,
	moneyFormatFromLot,
	parkingVisitStatusLabel,
	unwrapApiResult,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	CarReportRow,
	LotReport,
	OperatorContext,
	OwnerReportRow,
	ReceiptPreview,
	SessionSnapshot,
} from "@/features/operator-operations/models/operator-operations.types";
import { SessionDetailSheet } from "@/features/operator-operations/views/session-detail-sheet";
import { cn } from "@/lib/utils";
import { eden } from "@/server/eden";

interface ReportsTabProps {
	operatorContext: OperatorContext;
	selectedLotId: string | null;
	onSelectLot: (lotId: string) => void;
	onNavigateToGate: () => void;
	onReceiptReady: (preview: ReceiptPreview, sessionId: string) => void;
}

type DetailTarget =
	| { customerPhone: string; kind: "owner"; label: string }
	| { kind: "vehicle"; label: string; normalizedPlateNumber: string };

function SessionRow({
	session,
	moneyFormat,
	onOpen,
}: {
	session: SessionSnapshot;
	moneyFormat: MoneyFormatOptions;
	onOpen: () => void;
}) {
	const paid =
		session.status === "closed" && session.finalAmount != null
			? formatCurrency(session.finalAmount, moneyFormat)
			: "—";

	return (
		<button
			className='flex w-full gap-3 rounded-2xl bg-white px-3 py-3 text-start ring-1 ring-accent ring-border/60 transition-transform active:scale-[0.99] dark:bg-card'
			onClick={onOpen}
			type='button'>
			<div className='min-w-0 flex-1'>
				<div className='flex flex-wrap items-center gap-2'>
					<p className='font-mono font-semibold text-sm tracking-wide'>
						{session.displayPlateNumber}
					</p>
					<Badge
						className='rounded-full px-2 py-0 text-[0.65rem]'
						variant={session.status === "closed" ? "secondary" : "default"}>
						{parkingVisitStatusLabel(session.status)}
					</Badge>
				</div>
				<p className='mt-1 text-muted-foreground text-xs'>
					{formatDateTime(session.entryAt, moneyFormat.countryCode)}
					{session.exitAt
						? ` → ${formatDateTime(session.exitAt, moneyFormat.countryCode)}`
						: ""}
					{session.parkingGateName ? ` · ${session.parkingGateName}` : ""}
				</p>
			</div>
			<div className='shrink-0 text-end'>
				<p className='font-semibold text-sm tabular-nums'>{paid}</p>
				{session.overrideAmount != null && session.overrideAmount > 0 && (
					<p className='text-[0.65rem] text-muted-foreground'>Adjusted</p>
				)}
			</div>
		</button>
	);
}

export function ReportsTab({
	operatorContext,
	selectedLotId,
	onSelectLot,
	onNavigateToGate,
	onReceiptReady,
}: ReportsTabProps) {
	const queryClient = useQueryClient();
	const [detail, setDetail] = useState<DetailTarget | null>(null);
	const [sheetSession, setSheetSession] = useState<SessionSnapshot | null>(
		null,
	);

	const activeLot =
		operatorContext.allowedLots.find((l) => l.id === selectedLotId) ?? null;
	const lotMoneyFormat = moneyFormatFromLot(activeLot);

	const selectLotMutation = useMutation({
		mutationFn: async (parkingLotId: string) =>
			unwrapApiResult<OperatorContext>(
				await eden.operator["select-lot"].post({ parkingLotId }),
			),
		onSuccess: async (context) => {
			onSelectLot(context.selectedParkingLotId ?? "");
			await queryClient.invalidateQueries({ queryKey: ["operator-context"] });
			await queryClient.invalidateQueries({ queryKey: ["operator-sessions"] });
			await queryClient.invalidateQueries({ queryKey: ["operator-reports"] });
		},
	});

	const reportQuery = useQuery({
		enabled: Boolean(selectedLotId && operatorContext.workspaceReady),
		queryKey: ["operator-reports", selectedLotId],
		queryFn: async () =>
			unwrapApiResult<LotReport>(
				await eden.operator.reports.get({
					query: { parkingLotId: selectedLotId ?? undefined },
				}),
			),
	});

	const detailQuery = useQuery({
		enabled: Boolean(detail && selectedLotId),
		queryKey: [
			"operator-report-detail",
			detail?.kind,
			selectedLotId,
			detail?.kind === "vehicle"
				? detail.normalizedPlateNumber
				: detail?.kind === "owner"
					? detail.customerPhone
					: null,
		],
		queryFn: async () => {
			if (!detail || !selectedLotId) return [];

			if (detail.kind === "vehicle") {
				return unwrapApiResult<SessionSnapshot[]>(
					await eden.operator.reports.car.get({
						query: {
							normalizedPlateNumber: detail.normalizedPlateNumber,
							parkingLotId: selectedLotId,
						},
					}),
				);
			}

			return unwrapApiResult<SessionSnapshot[]>(
				await eden.operator.reports.owner.get({
					query: {
						customerPhone: detail.customerPhone,
						parkingLotId: selectedLotId,
					},
				}),
			);
		},
	});

	const report = reportQuery.data;

	const detailSummary = useMemo(() => {
		const sessions = detailQuery.data ?? [];
		const revenue = sessions.reduce((sum, s) => {
			if (s.status === "closed" && s.finalAmount != null) {
				return sum + s.finalAmount;
			}
			return sum;
		}, 0);
		return { revenue, visits: sessions.length };
	}, [detailQuery.data]);

	return (
		<div className='safe-top flex min-h-full flex-col gap-5 bg-white px-5 pt-20 pb-4 dark:bg-background'>
			<div>
				<p className='text-muted-foreground text-sm'>Lot performance</p>
				<h1 className='mt-0.5 font-bold text-2xl tracking-tight'>Reports</h1>
			</div>

			{operatorContext.allowedLots.length > 1 ? (
				<Select
					disabled={selectLotMutation.isPending}
					onValueChange={(value) => {
						if (!value) return;
						onSelectLot(value);
						selectLotMutation.mutate(value);
					}}
					value={selectedLotId ?? null}>
					<SelectTrigger
						className='h-11 w-full rounded-[1.25rem] bg-white px-4 ring-1 ring-border [box-shadow:rgba(14,15,12,0.12)_0px_0px_0px_1px] dark:bg-card'
						size='default'>
						<div className='flex items-center gap-2'>
							<span className='size-2 rounded-full bg-primary' />
							<SelectValue placeholder='Select parking lot'>
								{activeLot?.name}
							</SelectValue>
						</div>
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{operatorContext.allowedLots.map((lot) => (
								<SelectItem
									key={lot.id}
									label={lot.name}
									value={lot.id}>
									{lot.name}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			) : (
				activeLot && (
					<div className='flex items-center gap-2.5 rounded-[1.25rem] bg-white px-4 py-3 ring-1 ring-border [box-shadow:rgba(14,15,12,0.12)_0px_0px_0px_1px] dark:bg-card'>
						<span className='size-2 rounded-full bg-primary' />
						<span className='font-medium text-sm'>{activeLot.name}</span>
						<span className='rounded-full bg-primary/15 px-2.5 py-0.5 font-mono text-primary text-xs'>
							{activeLot.code}
						</span>
					</div>
				)
			)}

			{reportQuery.isPending && (
				<div className='space-y-3'>
					<div className='h-36 animate-pulse rounded-[1.75rem] bg-primary/5 ring-1 ring-border dark:bg-muted/30' />
					<div className='h-48 animate-pulse rounded-[1.75rem] bg-primary/5 ring-1 ring-border dark:bg-muted/30' />
				</div>
			)}

			{reportQuery.isError && (
				<div className='rounded-[1.75rem] bg-destructive/10 px-4 py-6 text-center text-destructive text-sm ring-1 ring-destructive/20'>
					{reportQuery.error instanceof Error
						? reportQuery.error.message
						: "Could not load reports."}
				</div>
			)}

			{report && !reportQuery.isPending && (
				<>
					<section className='overflow-hidden rounded-[1.75rem] bg-linear-to-br from-primary/20 via-primary/8 to-transparent p-5 ring-1 ring-primary/15 [box-shadow:rgba(14,15,12,0.12)_0px_0px_0px_1px]'>
						<div className='flex items-start justify-between gap-3'>
							<div>
								<p className='font-semibold text-muted-foreground text-xs uppercase tracking-wider'>
									Total revenue
								</p>
								<p className='mt-2 font-bold text-4xl tracking-tighter'>
									{formatCurrency(report.totalRevenue, lotMoneyFormat)}
								</p>
								<p className='mt-1 text-muted-foreground text-xs'>
									From {report.closedSessionCount} completed exits
								</p>
							</div>
							<div className='flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15'>
								<HugeiconsIcon
									className='text-primary'
									icon={Analytics01Icon}
									size={24}
									strokeWidth={1.8}
								/>
							</div>
						</div>

						<div className='mt-5 grid grid-cols-2 gap-3'>
							<div className='rounded-2xl bg-white px-3 py-3 ring-1 ring-border/50 dark:bg-card/80'>
								<p className='font-bold text-2xl tabular-nums tracking-tight'>
									{report.uniqueCarCount}
								</p>
								<p className='text-muted-foreground text-xs'>Vehicles</p>
							</div>
							<div className='rounded-2xl bg-white px-3 py-3 ring-1 ring-border/50 dark:bg-card/80'>
								<p className='font-bold text-2xl tabular-nums tracking-tight'>
									{report.uniqueOwnerCount}
								</p>
								<p className='text-muted-foreground text-xs'>Customers</p>
							</div>
						</div>
					</section>

					<Tabs
						className='w-full gap-4'
						defaultValue='vehicles'>
						<TabsList className='grid h-11 w-full grid-cols-2 gap-1 rounded-full bg-white p-1 ring-1 ring-border/70 dark:bg-muted/80'>
							<TabsTrigger
								className={cn(
									"gap-2 rounded-full font-semibold text-xs",
									"text-muted-foreground shadow-none ring-0",
									"data-active:bg-accent data-active:text-accent-foreground data-active:hover:text-accent-foreground",
									"data-active:shadow-sm data-active:ring-1 data-active:ring-border/80",
									"dark:data-active:bg-card [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
									"data-active:[&_svg]:text-accent-foreground",
								)}
								value='vehicles'>
								<HugeiconsIcon
									className='size-4'
									icon={Car03Icon}
									strokeWidth={2}
								/>
								By vehicle
							</TabsTrigger>
							<TabsTrigger
								className={cn(
									"gap-2 rounded-full font-semibold text-xs",
									"text-muted-foreground shadow-none ring-0",
									"data-active:bg-accent data-active:text-accent-foreground data-active:hover:text-accent-foreground",
									"data-active:shadow-sm data-active:ring-1 data-active:ring-border/80",
									"dark:data-active:bg-card [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
									"data-active:[&_svg]:text-accent-foreground",
								)}
								value='owners'>
								<HugeiconsIcon
									className='size-4'
									icon={Call02Icon}
									strokeWidth={2}
								/>
								By customer
							</TabsTrigger>
						</TabsList>

						<TabsContent
							className='flex flex-col gap-2'
							value='vehicles'>
							{report.cars.length === 0 ? (
								<div className='rounded-[1.5rem] bg-white px-5 py-10 text-center text-muted-foreground text-sm ring-1 ring-border dark:bg-card'>
									No parking history yet for this lot.
								</div>
							) : (
								report.cars.map((row: CarReportRow) => (
									<button
										className={cn(
											"flex w-full items-center gap-3 rounded-[1.25rem] bg-white p-4 text-start ring-1 ring-border transition-transform [box-shadow:rgba(14,15,12,0.12)_0px_0px_0px_1px] active:scale-[0.98] dark:bg-card",
										)}
										key={row.normalizedPlateNumber}
										onClick={() =>
											setDetail({
												kind: "vehicle",
												label: row.displayPlateNumber,
												normalizedPlateNumber: row.normalizedPlateNumber,
											})
										}
										type='button'>
										<div className='flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12'>
											<HugeiconsIcon
												className='text-primary'
												icon={Car03Icon}
												size={22}
												strokeWidth={1.8}
											/>
										</div>
										<div className='min-w-0 flex-1'>
											<p className='font-mono font-semibold text-sm tracking-wide'>
												{row.displayPlateNumber}
											</p>
											<p className='text-muted-foreground text-xs'>
												{row.visitCount} visits
												{row.vehicleType ? ` · ${row.vehicleType}` : ""}
											</p>
										</div>
										<div className='shrink-0 text-end'>
											<p className='font-semibold text-sm tabular-nums'>
												{formatCurrency(row.totalRevenue, lotMoneyFormat)}
											</p>
										</div>
									</button>
								))
							)}
						</TabsContent>

						<TabsContent
							className='flex flex-col gap-2'
							value='owners'>
							{report.owners.length === 0 ? (
								<div className='rounded-[1.5rem] bg-white px-5 py-10 text-center text-muted-foreground text-sm ring-1 ring-border dark:bg-card'>
									No customer visits recorded yet.
								</div>
							) : (
								report.owners.map((row: OwnerReportRow) => (
									<button
										className='flex w-full items-center gap-3 rounded-[1.25rem] bg-white p-4 text-start ring-1 ring-border transition-transform [box-shadow:rgba(14,15,12,0.12)_0px_0px_0px_1px] active:scale-[0.98] dark:bg-card'
										key={row.customerPhone}
										onClick={() =>
											setDetail({
												customerPhone: row.customerPhone,
												kind: "owner",
												label: row.customerName || row.customerPhone,
											})
										}
										type='button'>
										<div className='flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12'>
											<HugeiconsIcon
												className='text-primary'
												icon={Call02Icon}
												size={22}
												strokeWidth={1.8}
											/>
										</div>
										<div className='min-w-0 flex-1'>
											<p className='truncate font-semibold text-sm'>
												{row.customerName || "Customer"}
											</p>
											<p className='truncate font-mono text-muted-foreground text-xs'>
												{row.customerPhone}
											</p>
										</div>
										<div className='shrink-0 text-end'>
											<p className='font-semibold text-sm tabular-nums'>
												{formatCurrency(row.totalRevenue, lotMoneyFormat)}
											</p>
											<p className='text-[0.65rem] text-muted-foreground'>
												{row.visitCount} visits
											</p>
										</div>
									</button>
								))
							)}
						</TabsContent>
					</Tabs>
				</>
			)}

			{detail && (
				<div
					aria-labelledby='report-detail-title'
					aria-modal='true'
					className='fixed inset-0 z-50 flex flex-col bg-white dark:bg-background'
					role='dialog'>
					<header className='safe-top flex shrink-0 items-center gap-1 border-border border-b bg-white px-1 py-2 dark:bg-background'>
						<Button
							aria-label='Back to reports'
							className='size-10 shrink-0 rounded-full'
							onClick={() => setDetail(null)}
							size='icon'
							type='button'
							variant='ghost'>
							<svg
								className='size-6 text-foreground'
								fill='none'
								stroke='currentColor'
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								viewBox='0 0 24 24'>
								<title>Back</title>
								<path d='M15 18l-6-6 6-6' />
							</svg>
						</Button>
						<div className='min-w-0 flex-1 pr-3'>
							<h2
								className='truncate font-bold text-xl tracking-tight'
								id='report-detail-title'>
								{detail.label}
							</h2>
							<p className='truncate text-muted-foreground text-sm'>
								{detail.kind === "vehicle"
									? "Parking visits and payments for this plate at this lot."
									: "Parking visits linked to this phone number at this lot."}
							</p>
						</div>
					</header>

					<div className='safe-bottom flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-white px-5 pt-4 dark:bg-background'>
						<div className='flex flex-col gap-3'>
							{detailQuery.isPending && (
								<div className='space-y-2'>
									<div className='h-16 animate-pulse rounded-2xl bg-primary/5 dark:bg-muted/30' />
									<div className='h-16 animate-pulse rounded-2xl bg-primary/5 dark:bg-muted/30' />
								</div>
							)}

							{detailQuery.isError && (
								<p className='text-destructive text-sm'>
									{detailQuery.error instanceof Error
										? detailQuery.error.message
										: "Could not load history."}
								</p>
							)}

							{detailQuery.data && !detailQuery.isPending && (
								<>
									<div className='grid grid-cols-2 gap-3'>
										<div className='rounded-2xl bg-white px-3 py-3 ring-1 ring-border/60 dark:bg-card'>
											<p className='text-muted-foreground text-xs'>Visits</p>
											<p className='font-bold text-xl tabular-nums'>
												{detailSummary.visits}
											</p>
										</div>
										<div className='rounded-2xl bg-white px-3 py-3 ring-1 ring-border/60 dark:bg-card'>
											<p className='text-muted-foreground text-xs'>
												Paid total
											</p>
											<p className='font-bold text-xl tabular-nums'>
												{formatCurrency(detailSummary.revenue, lotMoneyFormat)}
											</p>
										</div>
									</div>
									<Separator />
									<p className='font-semibold text-muted-foreground text-xs uppercase tracking-wide'>
										Visit history
									</p>
									<div className='flex flex-col gap-2 pb-8'>
										{detailQuery.data.length === 0 ? (
											<p className='text-muted-foreground text-sm'>
												No visits found.
											</p>
										) : (
											detailQuery.data.map((session) => (
												<SessionRow
													key={session.id}
													moneyFormat={lotMoneyFormat}
													onOpen={() => setSheetSession(session)}
													session={session}
												/>
											))
										)}
									</div>
								</>
							)}
						</div>
					</div>
				</div>
			)}

			<SessionDetailSheet
				baseRate={activeLot?.baseRate ?? 0}
				moneyFormat={lotMoneyFormat}
				onEdit={onNavigateToGate}
				onOpenChange={(open) => {
					if (!open) setSheetSession(null);
				}}
				onReceiptReady={onReceiptReady}
				open={sheetSession !== null}
				parkingLotName={activeLot?.name ?? "Parking lot"}
				session={sheetSession}
			/>
		</div>
	);
}
