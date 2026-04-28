"use client";

import {
	formatCurrency,
	formatDateTime,
	formatDuration,
	type MoneyFormatOptions,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type { SessionSnapshot } from "@/features/operator-operations/models/operator-operations.types";
import { cn } from "@/lib/utils";

function getEstimatedSessionAmount(session: SessionSnapshot): number {
	if (session.rateMode === "session") return session.baseRateSnapshot;
	const elapsedMs = Math.max(0, Date.now() - new Date(session.entryAt).getTime());
	return session.baseRateSnapshot * (elapsedMs / (1000 * 60 * 60));
}

export function LiveActivityItem({
	session,
	moneyFormat,
	onClick,
	className,
}: {
	session: SessionSnapshot;
	moneyFormat: MoneyFormatOptions;
	onClick: () => void;
	className?: string;
}) {
	return (
		<button
			className={cn(
				"flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left ring-1 ring-border transition-transform active:scale-[0.98]",
				className,
			)}
			onClick={onClick}
			type="button"
		>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex items-start justify-between gap-3">
					<p className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 font-mono font-semibold text-primary-foreground text-xs tracking-wider">
						<span aria-hidden>
							{session.vehicleType === "HMV" ? (
								<svg aria-hidden="true" className="size-3.5" fill="none" focusable="false" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
									<path d="M2 10h11v7H2z" />
									<path d="M13 12h4l2 2v3h-6z" />
									<circle cx="6" cy="18" r="1.8" />
									<circle cx="16" cy="18" r="1.8" />
									<circle cx="20" cy="18" r="1.8" />
								</svg>
							) : (
								<svg aria-hidden="true" className="size-3.5" fill="none" focusable="false" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
									<path d="M3 13h18v4a2 2 0 0 1-2 2h-1" />
									<path d="M3 17a2 2 0 0 0 2 2h1" />
									<path d="M5 13l2-5h10l2 5" />
									<circle cx="8" cy="18" r="1.8" />
									<circle cx="16" cy="18" r="1.8" />
								</svg>
							)}
						</span>
						<span className="truncate">{session.displayPlateNumber}</span>
					</p>
					<p className="shrink-0 font-medium text-primary text-xs">
						{formatCurrency(getEstimatedSessionAmount(session), moneyFormat)}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
					<span>{formatDuration(session.entryAt, new Date())} parked</span>
					<span aria-hidden>•</span>
					<span>Entered {formatDateTime(session.entryAt, moneyFormat.countryCode)}</span>
					{session.parkingGateName ? (
						<>
							<span aria-hidden>•</span>
							<span>Gate {session.parkingGateName}</span>
						</>
					) : null}
				</div>
			</div>
		</button>
	);
}
