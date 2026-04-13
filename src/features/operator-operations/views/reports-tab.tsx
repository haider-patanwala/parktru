"use client";

import {
	DateField,
	DateRangePicker,
	Button as HeroButton,
	Label as HeroLabel,
	Select as HeroSelect,
	ListBox,
	RangeCalendar,
	SearchField,
} from "@heroui/react";
import {
	Analytics01Icon,
	Call02Icon,
	Car03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { DateValue } from "@internationalized/date";
import { getLocalTimeZone } from "@internationalized/date";
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
	normalizePlateNumber,
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
import {
	mergeLotReportOverlay,
	persistLotReportFromServer,
	postSelectLotWithOffline,
} from "@/features/operator-operations/sync/operator.actions";
import { loadSessionLists } from "@/features/operator-operations/sync/operator.store";
import { SessionDetailSheet } from "@/features/operator-operations/views/session-detail-sheet";
import { cn } from "@/lib/utils";
import { eden } from "@/server/eden";

interface ReportsTabProps {
	operatorContext: OperatorContext;
	onNavigateToGate: () => void;
	onReceiptReady: (preview: ReceiptPreview, sessionId: string) => void;
	onSelectLot: (lotId: string) => void;
	selectedLotId: string | null;
	userId: string;
}

type DetailTarget =
	| { customerPhone: string; kind: "owner"; label: string }
	| { kind: "vehicle"; label: string; normalizedPlateNumber: string };

type ReportDateRange = { end: DateValue; start: DateValue };

type ReportSortKey =
	| "label_asc"
	| "oldest"
	| "recent"
	| "revenue_asc"
	| "revenue_desc"
	| "visits_asc"
	| "visits_desc";

const REPORT_SORT_OPTIONS: { id: ReportSortKey; label: string }[] = [
	{ id: "revenue_desc", label: "Revenue (high → low)" },
	{ id: "revenue_asc", label: "Revenue (low → high)" },
	{ id: "visits_desc", label: "Visits (most first)" },
	{ id: "visits_asc", label: "Visits (fewest first)" },
	{ id: "recent", label: "Last visit (newest)" },
	{ id: "oldest", label: "Last visit (oldest)" },
	{ id: "label_asc", label: "Name A → Z" },
];

const fieldTriggerClass =
	"min-h-9 w-full rounded-lg border border-primary/12 bg-white px-2.5 py-1 text-sm shadow-none ring-0 transition-colors hover:border-primary/20 hover:bg-primary/[0.03] focus-visible:border-primary/35 focus-visible:ring-[3px] focus-visible:ring-primary/15";

function lastVisitInSelectedRange(
	lastVisitAt: string | null,
	range: ReportDateRange | null,
): boolean {
	if (!range) return true;
	if (!lastVisitAt) return false;
	const t = new Date(lastVisitAt).getTime();
	const tz = getLocalTimeZone();
	const startMs = range.start.toDate(tz).getTime();
	const endMs = range.end.toDate(tz).getTime() + 24 * 60 * 60 * 1000 - 1;
	return t >= startMs && t <= endMs;
}

function visitTimeMs(iso: string | null): number {
	if (!iso) return 0;
	return new Date(iso).getTime();
}

function matchesCarSearch(row: CarReportRow, rawQuery: string): boolean {
	const q = rawQuery.trim();
	if (!q) return true;
	const qNorm = normalizePlateNumber(q);
	const qLower = q.toLowerCase();
	if (qNorm && row.normalizedPlateNumber.includes(qNorm)) return true;
	if (row.displayPlateNumber.toLowerCase().includes(qLower)) return true;
	if (row.vehicleType && row.vehicleType.toLowerCase().includes(qLower))
		return true;
	return false;
}

function matchesOwnerSearch(row: OwnerReportRow, rawQuery: string): boolean {
	const q = rawQuery.trim();
	if (!q) return true;
	const qLower = q.toLowerCase();
	if ((row.customerName || "").toLowerCase().includes(qLower)) return true;
	if (row.customerPhone.toLowerCase().includes(qLower)) return true;
	const digitsQ = q.replace(/\D/g, "");
	if (
		digitsQ.length >= 3 &&
		row.customerPhone.replace(/\D/g, "").includes(digitsQ)
	) {
		return true;
	}
	return false;
}

function sortCarRows(rows: CarReportRow[], key: ReportSortKey): CarReportRow[] {
	return [...rows].sort((a, b) => {
		switch (key) {
			case "revenue_desc":
				return b.totalRevenue - a.totalRevenue;
			case "revenue_asc":
				return a.totalRevenue - b.totalRevenue;
			case "visits_desc":
				return b.visitCount - a.visitCount;
			case "visits_asc":
				return a.visitCount - b.visitCount;
			case "recent":
				return visitTimeMs(b.lastVisitAt) - visitTimeMs(a.lastVisitAt);
			case "oldest":
				return visitTimeMs(a.lastVisitAt) - visitTimeMs(b.lastVisitAt);
			case "label_asc":
				return a.displayPlateNumber.localeCompare(
					b.displayPlateNumber,
					undefined,
					{
						sensitivity: "base",
					},
				);
			default:
				return 0;
		}
	});
}

function sortOwnerRows(
	rows: OwnerReportRow[],
	key: ReportSortKey,
): OwnerReportRow[] {
	return [...rows].sort((a, b) => {
		const labelA = a.customerName?.trim() || a.customerPhone;
		const labelB = b.customerName?.trim() || b.customerPhone;
		switch (key) {
			case "revenue_desc":
				return b.totalRevenue - a.totalRevenue;
			case "revenue_asc":
				return a.totalRevenue - b.totalRevenue;
			case "visits_desc":
				return b.visitCount - a.visitCount;
			case "visits_asc":
				return a.visitCount - b.visitCount;
			case "recent":
				return visitTimeMs(b.lastVisitAt) - visitTimeMs(a.lastVisitAt);
			case "oldest":
				return visitTimeMs(a.lastVisitAt) - visitTimeMs(b.lastVisitAt);
			case "label_asc":
				return labelA.localeCompare(labelB, undefined, { sensitivity: "base" });
			default:
				return 0;
		}
	});
}

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
			className="flex w-full gap-2.5 rounded-xl border border-primary/10 bg-white px-3 py-2 text-start shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-transform active:scale-[0.99] dark:border-primary/20 dark:bg-card"
			onClick={onOpen}
			type="button"
		>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-1.5">
					<p className="font-mono font-semibold text-sm tracking-wide">
						{session.displayPlateNumber}
					</p>
					<Badge
						className="rounded-full px-2 py-0 text-[0.65rem]"
						variant={session.status === "closed" ? "secondary" : "default"}
					>
						{parkingVisitStatusLabel(session.status)}
					</Badge>
				</div>
				<p className="mt-1 text-muted-foreground text-xs">
					{formatDateTime(session.entryAt, moneyFormat.countryCode)}
					{session.exitAt
						? ` → ${formatDateTime(session.exitAt, moneyFormat.countryCode)}`
						: ""}
					{session.parkingGateName ? ` · ${session.parkingGateName}` : ""}
				</p>
			</div>
			<div className="shrink-0 text-end">
				<p className="font-semibold text-sm tabular-nums">{paid}</p>
				{session.overrideAmount != null && session.overrideAmount > 0 && (
					<p className="text-[0.65rem] text-muted-foreground">Adjusted</p>
				)}
			</div>
		</button>
	);
}

export function ReportsTab({
	operatorContext,
	onNavigateToGate,
	onReceiptReady,
	onSelectLot,
	selectedLotId,
	userId,
}: ReportsTabProps) {
	const queryClient = useQueryClient();
	const [detail, setDetail] = useState<DetailTarget | null>(null);
	const [sheetSession, setSheetSession] = useState<SessionSnapshot | null>(
		null,
	);
	const [sortKey, setSortKey] = useState<ReportSortKey>("revenue_desc");
	const [dateRange, setDateRange] = useState<ReportDateRange | null>(null);
	const [searchText, setSearchText] = useState("");

	const activeLot =
		operatorContext.allowedLots.find((l) => l.id === selectedLotId) ?? null;
	const lotMoneyFormat = moneyFormatFromLot(activeLot);

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
			await queryClient.invalidateQueries({ queryKey: ["operator-reports"] });
		},
	});

	const reportQuery = useQuery({
		enabled: Boolean(selectedLotId && operatorContext.workspaceReady),
		queryKey: ["operator-reports", selectedLotId, userId],
		queryFn: async () => {
			if (
				typeof navigator !== "undefined" &&
				!navigator.onLine &&
				userId &&
				selectedLotId
			) {
				const lists = await loadSessionLists(userId, selectedLotId);
				if (lists) {
					return mergeLotReportOverlay(userId, selectedLotId, lists);
				}
			}
			const report = unwrapApiResult<LotReport>(
				await eden.operator.reports.get({
					query: { parkingLotId: selectedLotId ?? undefined },
				}),
			);
			if (userId && selectedLotId) {
				await persistLotReportFromServer(userId, selectedLotId, report);
			}
			return report;
		},
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

			if (typeof navigator !== "undefined" && !navigator.onLine && userId) {
				const lists = await loadSessionLists(userId, selectedLotId);
				if (lists) {
					const pool = [...lists.activeSessions, ...lists.recentSessions];
					if (detail.kind === "vehicle") {
						return pool.filter(
							(s) =>
								normalizePlateNumber(s.displayPlateNumber) ===
								detail.normalizedPlateNumber,
						);
					}
					return pool.filter(
						(s) => s.customerPhone.trim() === detail.customerPhone.trim(),
					);
				}
			}

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

	const searchTrim = searchText.trim();

	const carRowsAfterDate = useMemo(() => {
		if (!report) return [];
		return report.cars.filter((r) =>
			lastVisitInSelectedRange(r.lastVisitAt, dateRange),
		);
	}, [report, dateRange]);

	const ownerRowsAfterDate = useMemo(() => {
		if (!report) return [];
		return report.owners.filter((r) =>
			lastVisitInSelectedRange(r.lastVisitAt, dateRange),
		);
	}, [report, dateRange]);

	const filteredCars = useMemo(() => {
		const rows = searchTrim
			? carRowsAfterDate.filter((r) => matchesCarSearch(r, searchTrim))
			: carRowsAfterDate;
		return sortCarRows(rows, sortKey);
	}, [carRowsAfterDate, searchTrim, sortKey]);

	const filteredOwners = useMemo(() => {
		const rows = searchTrim
			? ownerRowsAfterDate.filter((r) => matchesOwnerSearch(r, searchTrim))
			: ownerRowsAfterDate;
		return sortOwnerRows(rows, sortKey);
	}, [ownerRowsAfterDate, searchTrim, sortKey]);

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
		<div className="safe-top flex min-h-full flex-col gap-2.5 bg-background px-3 pt-16 pb-3">
			<div className="flex flex-col gap-0.5">
				<h1 className="font-semibold text-lg leading-tight tracking-tight">
					Reports
				</h1>
				<p className="text-[0.65rem] text-muted-foreground">Lot performance</p>
			</div>

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
						className="h-9 w-full rounded-lg border border-primary/12 bg-white px-3 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-primary/20 dark:bg-card"
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
					<div className="flex items-center gap-2 rounded-lg border border-primary/12 bg-white px-3 py-2 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-primary/20 dark:bg-card">
						<span className="size-1.5 rounded-full bg-primary" />
						<span className="font-medium">{activeLot.name}</span>
						<span className="rounded-full bg-primary/15 px-2 py-0 font-mono text-[0.65rem] text-primary">
							{activeLot.code}
						</span>
					</div>
				)
			)}

			{reportQuery.isPending && (
				<div className="space-y-2">
					<div className="h-14 animate-pulse rounded-lg bg-white ring-1 ring-primary/10 dark:bg-primary/10 dark:ring-primary/20" />
					<div className="h-24 animate-pulse rounded-lg bg-white ring-1 ring-primary/10 dark:bg-primary/10 dark:ring-primary/20" />
				</div>
			)}

			{reportQuery.isError && (
				<div className="rounded-xl bg-destructive/10 px-3 py-3 text-center text-destructive text-sm ring-1 ring-destructive/20">
					{reportQuery.error instanceof Error
						? reportQuery.error.message
						: "Could not load reports."}
				</div>
			)}

			{report && !reportQuery.isPending && (
				<>
					<section className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-primary/12 bg-white px-2.5 py-2 text-sm leading-tight shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-primary/20 dark:bg-card">
						<div className="flex min-w-0 items-baseline gap-1.5">
							<HugeiconsIcon
								className="shrink-0 text-primary/80"
								icon={Analytics01Icon}
								size={14}
								strokeWidth={2}
							/>
							<span className="text-[0.65rem] text-muted-foreground uppercase tracking-wide">
								Revenue
							</span>
							<span className="font-semibold text-foreground tabular-nums">
								{formatCurrency(report.totalRevenue, lotMoneyFormat)}
							</span>
						</div>
						<span
							aria-hidden
							className="hidden h-3 w-px bg-border/80 sm:block"
						/>
						<span className="text-[0.7rem] text-muted-foreground">
							{report.closedSessionCount} exits
						</span>
						<span className="text-[0.7rem] text-muted-foreground">
							<span className="font-medium text-foreground tabular-nums">
								{report.uniqueCarCount}
							</span>{" "}
							veh
						</span>
						<span className="text-[0.7rem] text-muted-foreground">
							<span className="font-medium text-foreground tabular-nums">
								{report.uniqueOwnerCount}
							</span>{" "}
							customers
						</span>
					</section>

					<section className="flex flex-col gap-2 rounded-lg border border-primary/10 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-primary/20 dark:bg-card">
						<SearchField
							className="w-full"
							onChange={setSearchText}
							value={searchText}
						>
							<HeroLabel className="font-medium text-[0.65rem] text-primary/70 uppercase tracking-wide">
								Search
							</HeroLabel>
							<SearchField.Group
								className={cn(
									fieldTriggerClass,
									"flex min-h-9 items-center gap-1.5 py-0 pr-1",
								)}
							>
								<SearchField.SearchIcon className="size-4 shrink-0 text-muted-foreground" />
								<SearchField.Input
									className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm shadow-none outline-none ring-0 placeholder:text-muted-foreground/80 focus:ring-0"
									placeholder="Plate, name, or phone…"
								/>
								<SearchField.ClearButton aria-label="Clear search" />
							</SearchField.Group>
						</SearchField>

						<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
							<HeroSelect
								className="min-w-0 flex-1"
								onChange={(key) => {
									if (key == null) return;
									setSortKey(String(key) as ReportSortKey);
								}}
								placeholder="Sort by"
								value={sortKey}
							>
								<HeroLabel className="font-medium text-[0.65rem] text-primary/70 uppercase tracking-wide">
									Sort
								</HeroLabel>
								<HeroSelect.Trigger className={cn(fieldTriggerClass, "w-full")}>
									<HeroSelect.Value />
									<HeroSelect.Indicator />
								</HeroSelect.Trigger>
								<HeroSelect.Popover className="max-h-[min(24rem,70vh)]">
									<ListBox>
										{REPORT_SORT_OPTIONS.map((opt) => (
											<ListBox.Item
												id={opt.id}
												key={opt.id}
												textValue={opt.label}
											>
												{opt.label}
												<ListBox.ItemIndicator />
											</ListBox.Item>
										))}
									</ListBox>
								</HeroSelect.Popover>
							</HeroSelect>

							<div className="min-w-0 flex-1">
								<DateRangePicker
									className="w-full"
									endName="reportRangeEnd"
									onChange={(next) => {
										setDateRange(next);
									}}
									startName="reportRangeStart"
									value={dateRange ?? undefined}
								>
									<HeroLabel className="font-medium text-[0.65rem] text-primary/70 uppercase tracking-wide">
										Last visit
									</HeroLabel>
									<DateField.Group fullWidth>
										<DateField.Input slot="start">
											{(segment) => <DateField.Segment segment={segment} />}
										</DateField.Input>
										<DateRangePicker.RangeSeparator />
										<DateField.Input slot="end">
											{(segment) => <DateField.Segment segment={segment} />}
										</DateField.Input>
										<DateField.Suffix>
											<DateRangePicker.Trigger>
												<DateRangePicker.TriggerIndicator />
											</DateRangePicker.Trigger>
										</DateField.Suffix>
									</DateField.Group>
									<DateRangePicker.Popover>
										<RangeCalendar aria-label="Filter by last visit date">
											<RangeCalendar.Header>
												<RangeCalendar.YearPickerTrigger>
													<RangeCalendar.YearPickerTriggerHeading />
													<RangeCalendar.YearPickerTriggerIndicator />
												</RangeCalendar.YearPickerTrigger>
												<RangeCalendar.NavButton slot="previous" />
												<RangeCalendar.NavButton slot="next" />
											</RangeCalendar.Header>
											<RangeCalendar.Grid>
												<RangeCalendar.GridHeader>
													{(day) => (
														<RangeCalendar.HeaderCell>
															{day}
														</RangeCalendar.HeaderCell>
													)}
												</RangeCalendar.GridHeader>
												<RangeCalendar.GridBody>
													{(date) => <RangeCalendar.Cell date={date} />}
												</RangeCalendar.GridBody>
											</RangeCalendar.Grid>
											<RangeCalendar.YearPickerGrid>
												<RangeCalendar.YearPickerGridBody>
													{({ year }) => (
														<RangeCalendar.YearPickerCell year={year} />
													)}
												</RangeCalendar.YearPickerGridBody>
											</RangeCalendar.YearPickerGrid>
										</RangeCalendar>
									</DateRangePicker.Popover>
								</DateRangePicker>
							</div>

							{dateRange ? (
								<HeroButton
									className="h-9 shrink-0 rounded-lg border border-primary/15 bg-white px-2.5 text-foreground text-xs hover:bg-primary/[0.04]"
									onPress={() => setDateRange(null)}
									variant="tertiary"
								>
									Clear
								</HeroButton>
							) : null}
						</div>
						{dateRange ? (
							<p className="text-[0.65rem] text-muted-foreground leading-snug">
								Last visit in range; rows without a date are hidden.
							</p>
						) : null}
					</section>

					<Tabs className="w-full gap-2" defaultValue="vehicles">
						<TabsList className="grid h-9 w-full grid-cols-2 gap-0.5 rounded-lg border border-primary/10 bg-white p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-primary/20 dark:bg-card">
							<TabsTrigger
								className={cn(
									"gap-1.5 rounded-md font-medium text-[0.7rem]",
									"text-muted-foreground shadow-none ring-0",
									"data-active:bg-primary/10 data-active:text-foreground data-active:hover:text-foreground",
									"data-active:shadow-none data-active:ring-1 data-active:ring-primary/15",
									"dark:data-active:bg-primary/15 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
									"data-active:[&_svg]:text-primary",
								)}
								value="vehicles"
							>
								<HugeiconsIcon
									className="size-3.5"
									icon={Car03Icon}
									strokeWidth={2}
								/>
								Vehicles
							</TabsTrigger>
							<TabsTrigger
								className={cn(
									"gap-1.5 rounded-md font-medium text-[0.7rem]",
									"text-muted-foreground shadow-none ring-0",
									"data-active:bg-primary/10 data-active:text-foreground data-active:hover:text-foreground",
									"data-active:shadow-none data-active:ring-1 data-active:ring-primary/15",
									"dark:data-active:bg-primary/15 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
									"data-active:[&_svg]:text-primary",
								)}
								value="owners"
							>
								<HugeiconsIcon
									className="size-3.5"
									icon={Call02Icon}
									strokeWidth={2}
								/>
								Customers
							</TabsTrigger>
						</TabsList>

						<TabsContent className="flex flex-col gap-1.5" value="vehicles">
							{report.cars.length === 0 ? (
								<div className="rounded-xl border border-primary/10 bg-white px-4 py-6 text-center text-muted-foreground text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-primary/20 dark:bg-card">
									No parking history yet for this lot.
								</div>
							) : carRowsAfterDate.length === 0 ? (
								<div className="rounded-xl border border-primary/10 bg-white px-4 py-6 text-center text-muted-foreground text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-primary/20 dark:bg-card">
									{dateRange
										? "No vehicles match this date range."
										: "No vehicles with a last visit on record."}
								</div>
							) : filteredCars.length === 0 ? (
								<div className="rounded-xl border border-primary/10 bg-white px-4 py-6 text-center text-muted-foreground text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-primary/20 dark:bg-card">
									{searchTrim
										? "No vehicles match your search."
										: "No vehicles to show."}
								</div>
							) : (
								filteredCars.map((row: CarReportRow) => (
									<button
										className={cn(
											"flex w-full items-center gap-2.5 rounded-xl border border-primary/10 bg-white px-3 py-2.5 text-start shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-transform active:scale-[0.98] dark:border-primary/20 dark:bg-card",
										)}
										key={row.normalizedPlateNumber}
										onClick={() =>
											setDetail({
												kind: "vehicle",
												label: row.displayPlateNumber,
												normalizedPlateNumber: row.normalizedPlateNumber,
											})
										}
										type="button"
									>
										<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12">
											<HugeiconsIcon
												className="text-primary"
												icon={Car03Icon}
												size={18}
												strokeWidth={1.8}
											/>
										</div>
										<div className="min-w-0 flex-1">
											<p className="font-mono font-semibold text-sm tracking-wide">
												{row.displayPlateNumber}
											</p>
											<p className="text-[0.65rem] text-muted-foreground leading-tight">
												{row.visitCount} visits
												{row.vehicleType ? ` · ${row.vehicleType}` : ""}
											</p>
										</div>
										<div className="shrink-0 text-end">
											<p className="font-semibold text-sm tabular-nums leading-none">
												{formatCurrency(row.totalRevenue, lotMoneyFormat)}
											</p>
										</div>
									</button>
								))
							)}
						</TabsContent>

						<TabsContent className="flex flex-col gap-1.5" value="owners">
							{report.owners.length === 0 ? (
								<div className="rounded-xl border border-primary/10 bg-white px-4 py-6 text-center text-muted-foreground text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-primary/20 dark:bg-card">
									No customer visits recorded yet.
								</div>
							) : ownerRowsAfterDate.length === 0 ? (
								<div className="rounded-xl border border-primary/10 bg-white px-4 py-6 text-center text-muted-foreground text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-primary/20 dark:bg-card">
									{dateRange
										? "No customers match this date range."
										: "No customers with a last visit on record."}
								</div>
							) : filteredOwners.length === 0 ? (
								<div className="rounded-xl border border-primary/10 bg-white px-4 py-6 text-center text-muted-foreground text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-primary/20 dark:bg-card">
									{searchTrim
										? "No customers match your search."
										: "No customers to show."}
								</div>
							) : (
								filteredOwners.map((row: OwnerReportRow) => (
									<button
										className="flex w-full items-center gap-2.5 rounded-xl border border-primary/10 bg-white px-3 py-2.5 text-start shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-transform active:scale-[0.98] dark:border-primary/20 dark:bg-card"
										key={row.customerPhone}
										onClick={() =>
											setDetail({
												customerPhone: row.customerPhone,
												kind: "owner",
												label: row.customerName || row.customerPhone,
											})
										}
										type="button"
									>
										<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12">
											<HugeiconsIcon
												className="text-primary"
												icon={Call02Icon}
												size={18}
												strokeWidth={1.8}
											/>
										</div>
										<div className="min-w-0 flex-1">
											<p className="truncate font-semibold text-sm leading-tight">
												{row.customerName || "Customer"}
											</p>
											<p className="truncate font-mono text-[0.65rem] text-muted-foreground leading-tight">
												{row.customerPhone}
											</p>
										</div>
										<div className="shrink-0 text-end">
											<p className="font-semibold text-sm tabular-nums leading-none">
												{formatCurrency(row.totalRevenue, lotMoneyFormat)}
											</p>
											<p className="text-[0.65rem] text-muted-foreground leading-tight">
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
					aria-labelledby="report-detail-title"
					aria-modal="true"
					className="fixed inset-0 z-50 flex flex-col bg-background"
					role="dialog"
				>
					<header className="safe-top flex shrink-0 items-center gap-1 border-border border-b bg-background px-1 py-1.5">
						<Button
							aria-label="Back to reports"
							className="size-9 shrink-0 rounded-full"
							onClick={() => setDetail(null)}
							size="icon"
							type="button"
							variant="ghost"
						>
							<svg
								className="size-5 text-foreground"
								fill="none"
								stroke="currentColor"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								viewBox="0 0 24 24"
							>
								<title>Back</title>
								<path d="M15 18l-6-6 6-6" />
							</svg>
						</Button>
						<div className="min-w-0 flex-1 pr-2">
							<h2
								className="truncate font-semibold text-lg leading-tight tracking-tight"
								id="report-detail-title"
							>
								{detail.label}
							</h2>
							<p className="truncate text-[0.7rem] text-muted-foreground leading-snug">
								{detail.kind === "vehicle"
									? "Parking visits and payments for this plate at this lot."
									: "Parking visits linked to this phone number at this lot."}
							</p>
						</div>
					</header>

					<div className="safe-bottom flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-background px-3 pt-2">
						<div className="flex flex-col gap-2">
							{detailQuery.isPending && (
								<div className="space-y-1.5">
									<div className="h-12 animate-pulse rounded-xl border border-primary/10 bg-white dark:border-primary/20 dark:bg-primary/10" />
									<div className="h-12 animate-pulse rounded-xl border border-primary/10 bg-white dark:border-primary/20 dark:bg-primary/10" />
								</div>
							)}

							{detailQuery.isError && (
								<p className="text-destructive text-sm">
									{detailQuery.error instanceof Error
										? detailQuery.error.message
										: "Could not load history."}
								</p>
							)}

							{detailQuery.data && !detailQuery.isPending && (
								<>
									<div className="grid grid-cols-2 gap-2">
										<div className="rounded-lg border border-primary/10 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-primary/20 dark:bg-card">
											<p className="text-[0.65rem] text-muted-foreground">
												Visits
											</p>
											<p className="font-semibold text-lg tabular-nums leading-tight">
												{detailSummary.visits}
											</p>
										</div>
										<div className="rounded-lg border border-primary/10 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-primary/20 dark:bg-card">
											<p className="text-[0.65rem] text-muted-foreground">
												Paid total
											</p>
											<p className="font-semibold text-lg tabular-nums leading-tight">
												{formatCurrency(detailSummary.revenue, lotMoneyFormat)}
											</p>
										</div>
									</div>
									<Separator />
									<p className="font-medium text-[0.65rem] text-muted-foreground uppercase tracking-wide">
										Visit history
									</p>
									<div className="flex flex-col gap-1.5 pb-6">
										{detailQuery.data.length === 0 ? (
											<p className="text-muted-foreground text-sm">
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
				operatorContext={operatorContext}
				parkingLotName={activeLot?.name ?? "Parking lot"}
				session={sheetSession}
				userId={userId}
			/>
		</div>
	);
}
