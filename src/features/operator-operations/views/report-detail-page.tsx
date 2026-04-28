"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  formatCurrency,
  moneyFormatFromLot,
  normalizePlateNumber,
  unwrapApiResult,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type { OperatorContext, SessionSnapshot } from "@/features/operator-operations/models/operator-operations.types";
import { SessionDetailSheet } from "@/features/operator-operations/views/session-detail-sheet";
import { eden } from "@/server/eden";

interface ReportDetailPageProps {
  kind: "owner" | "vehicle";
  value: string;
  selectedLotId: string;
  operatorContext: OperatorContext;
  userId: string;
  backTo?: string;
}

export function ReportDetailPage({ kind, value, selectedLotId, operatorContext, userId, backTo }: ReportDetailPageProps) {
  const router = useRouter();
  const [sheetSession, setSheetSession] = useState<SessionSnapshot | null>(null);
  const activeLot = operatorContext.allowedLots.find((l) => l.id === selectedLotId) ?? null;
  const money = moneyFormatFromLot(activeLot);

  const detailQuery = useQuery({
    enabled: Boolean(selectedLotId),
    queryKey: ["operator-report-route-detail", kind, value, selectedLotId],
    queryFn: async () => {
      if (kind === "vehicle") {
        return unwrapApiResult<SessionSnapshot[]>(
          await eden.operator.reports.car.get({
            query: { normalizedPlateNumber: normalizePlateNumber(value), parkingLotId: selectedLotId },
          }),
        );
      }
      return unwrapApiResult<SessionSnapshot[]>(
        await eden.operator.reports.owner.get({
          query: { customerPhone: value, parkingLotId: selectedLotId },
        }),
      );
    },
  });

  const sessions = detailQuery.data ?? [];
  const revenue = sessions.reduce((sum, s) => (s.status === "closed" && s.finalAmount != null ? sum + s.finalAmount : sum), 0);
  const label = kind === "vehicle" ? value.toUpperCase() : value;

  return (
    <div className="safe-top min-h-dvh bg-background px-3 pt-16 pb-6">
      <header className="mb-3 flex items-center gap-2">
        <Button
          className="size-9 rounded-full"
          onClick={() => router.push(backTo && backTo.startsWith("/") ? backTo : "/operator?tab=reports")}
          size="icon"
          type="button"
          variant="ghost"
        >
          <svg className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate font-semibold text-xl">{label}</h1>
          <p className="text-xs text-muted-foreground">{kind === "vehicle" ? "Vehicle visit history" : "Customer visit history"}</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl border border-primary/10 bg-white px-3 py-2">
          <p className="text-[0.65rem] text-muted-foreground">Visits</p>
          <p className="font-semibold text-lg tabular-nums">{sessions.length}</p>
        </div>
        <div className="rounded-xl border border-primary/10 bg-white px-3 py-2">
          <p className="text-[0.65rem] text-muted-foreground">Paid total</p>
          <p className="font-semibold text-lg tabular-nums">{formatCurrency(revenue, money)}</p>
        </div>
      </div>

      <Separator className="my-3" />

      {detailQuery.isPending ? <p className="text-sm text-muted-foreground">Loading history…</p> : null}
      {detailQuery.isError ? <p className="text-sm text-destructive">Could not load history.</p> : null}

      <div className="flex flex-col gap-2">
        {sessions.map((session) => (
          <button
            className="flex w-full items-center justify-between rounded-xl border border-primary/10 bg-white px-3 py-2 text-left"
            key={session.id}
            onClick={() => setSheetSession(session)}
            type="button"
          >
            <div>
              <p className="font-mono text-sm">{session.displayPlateNumber}</p>
              <p className="text-xs text-muted-foreground">{session.customerName || session.customerPhone || "Customer"}</p>
            </div>
            <p className="text-sm font-semibold">{session.finalAmount != null ? formatCurrency(session.finalAmount, money) : "—"}</p>
          </button>
        ))}
      </div>

      <SessionDetailSheet
        baseRate={activeLot?.baseRate ?? 0}
        moneyFormat={money}
        onOpenChange={(open) => {
          if (!open) setSheetSession(null);
        }}
        onReceiptReady={() => {}}
        open={sheetSession !== null}
        operatorContext={operatorContext}
        parkingLotName={activeLot?.name ?? "Parking lot"}
        session={sheetSession}
        userId={userId}
      />
    </div>
  );
}
