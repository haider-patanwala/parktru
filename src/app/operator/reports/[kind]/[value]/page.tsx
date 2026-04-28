import { OperatorOperationsPage } from "@/features/operator-operations/views/operator-operations-page";

interface PageProps {
  params: Promise<{ kind: string; value: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function OperatorReportDetailRoute({ params, searchParams }: PageProps) {
  const p = await params;
  const q = await searchParams;

  const kind = p.kind === "vehicle" ? "vehicle" : "owner";
  const value = decodeURIComponent(p.value);
  const selectedLotId = typeof q.lotId === "string" ? q.lotId : "";
  const backTo = typeof q.backTo === "string" ? decodeURIComponent(q.backTo) : "/operator?tab=reports";

  if (!selectedLotId) {
    return <OperatorOperationsPage initialActiveTab="reports" />;
  }

  return (
    <OperatorOperationsPage
      embeddedReportDetail={{ backTo, kind, selectedLotId, value }}
      initialActiveTab="reports"
    />
  );
}
