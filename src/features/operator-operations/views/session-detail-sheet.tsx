"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	buildWhatsappUrlForSession,
	formatCurrency,
	formatDateTime,
	formatDuration,
	type MoneyFormatOptions,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	ReceiptPreview,
	SessionSnapshot,
} from "@/features/operator-operations/models/operator-operations.types";
import { SessionExitPanel } from "@/features/operator-operations/views/session-exit-panel";

interface SessionDetailSheetProps {
	session: SessionSnapshot | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	parkingLotName: string;
	baseRate: number;
	moneyFormat: MoneyFormatOptions;
	onEdit: () => void;
	onReceiptReady: (preview: ReceiptPreview, sessionId: string) => void;
}

export function SessionDetailSheet({
	session,
	open,
	onOpenChange,
	parkingLotName,
	baseRate,
	moneyFormat,
	onEdit,
	onReceiptReady,
}: SessionDetailSheetProps) {
	const shareWhatsapp = () => {
		if (!session) return;
		const url = buildWhatsappUrlForSession(
			session,
			parkingLotName,
			moneyFormat,
		);
		window.open(url, "_blank", "noopener,noreferrer");
	};

	const handleEdit = () => {
		onOpenChange(false);
		onEdit();
	};

	const handleReceipt = (preview: ReceiptPreview, sessionId: string) => {
		onOpenChange(false);
		onReceiptReady(preview, sessionId);
	};

	return (
		<Sheet
			onOpenChange={onOpenChange}
			open={open}>
			<SheetContent
				className='z-[60] max-h-[min(92dvh,800px)] gap-0 overflow-y-auto rounded-t-[1.75rem] border-0 bg-white p-0 pt-2 sm:max-w-lg dark:bg-background'
				overlayClassName='z-[60]'
				showCloseButton
				side='bottom'>
				{session && (
					<div className='flex flex-col gap-4 px-4 pt-2 pb-6'>
						<SheetHeader className='space-y-1 px-0 text-start'>
							<SheetTitle className='font-mono text-xl tracking-wide'>
								{session.displayPlateNumber}
							</SheetTitle>
							<SheetDescription className='text-start text-muted-foreground text-sm'>
								Session report · {parkingLotName}
							</SheetDescription>
						</SheetHeader>

						<div className='flex flex-wrap items-center gap-2'>
							<Badge
								variant={session.status === "active" ? "default" : "secondary"}>
								{session.status === "active" ? "Active" : "Closed"}
							</Badge>
							{session.parkingGateName ? (
								<span className='text-muted-foreground text-xs'>
									{session.parkingGateName}
								</span>
							) : null}
						</div>

						<div className='grid grid-cols-2 gap-3 text-sm'>
							<div className='rounded-2xl bg-white px-3 py-3 ring-1 ring-border/60 dark:bg-card'>
								<p className='text-muted-foreground text-xs'>Entry</p>
								<p className='mt-1 font-medium leading-snug'>
									{formatDateTime(session.entryAt, moneyFormat.countryCode)}
								</p>
							</div>
							<div className='rounded-2xl bg-white px-3 py-3 ring-1 ring-border/60 dark:bg-card'>
								<p className='text-muted-foreground text-xs'>Exit</p>
								<p className='mt-1 font-medium leading-snug'>
									{session.exitAt
										? formatDateTime(session.exitAt, moneyFormat.countryCode)
										: "—"}
								</p>
							</div>
							<div className='rounded-2xl bg-white px-3 py-3 ring-1 ring-border/60 dark:bg-card'>
								<p className='text-muted-foreground text-xs'>Duration</p>
								<p className='mt-1 font-medium'>
									{session.exitAt
										? formatDuration(session.entryAt, session.exitAt)
										: formatDuration(session.entryAt, new Date())}
								</p>
							</div>
							<div className='rounded-2xl bg-white px-3 py-3 ring-1 ring-border/60 dark:bg-card'>
								<p className='text-muted-foreground text-xs'>Amount</p>
								<p className='mt-1 font-semibold tabular-nums'>
									{session.status === "closed" && session.finalAmount != null
										? formatCurrency(session.finalAmount, moneyFormat)
										: "—"}
								</p>
							</div>
						</div>

						<div className='rounded-2xl bg-white px-3 py-3 ring-1 ring-border/60 dark:bg-card'>
							<p className='text-muted-foreground text-xs'>Customer</p>
							<p className='mt-1 font-medium'>{session.customerName || "—"}</p>
							<p className='mt-0.5 font-mono text-muted-foreground text-sm'>
								{session.customerPhone || "—"}
							</p>
						</div>

						<div className='flex flex-col gap-2 sm:flex-row'>
							<Button
								className='h-18 flex-1 rounded-xl py-3 font-semibold'
								onClick={shareWhatsapp}
								type='button'>
								Share on WhatsApp
							</Button>
							<Button
								className='h-18 flex-1 rounded-xl py-3 font-semibold'
								onClick={handleEdit}
								type='button'
								variant='outline'>
								Edit in Gate
							</Button>
						</div>

						{session.status === "active" && (
							<>
								<Separator />
								<SessionExitPanel
									baseRate={baseRate}
									moneyFormat={moneyFormat}
									onCancel={() => onOpenChange(false)}
									onReceiptReady={handleReceipt}
									session={session}
								/>
							</>
						)}
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
