"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { unwrapApiResult } from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	OperatorContext,
	ReceiptPreview,
	SessionLists,
} from "@/features/operator-operations/models/operator-operations.types";
import { authClient } from "@/server/better-auth/client";
import { eden } from "@/server/eden";
import { AuthScreen } from "./auth-screen";
import { DashboardTab } from "./dashboard-tab";
import { GateTab } from "./gate-tab";
import { OperatorShell, type TabId } from "./operator-shell";
import { ReceiptOverlay } from "./receipt-overlay";
import { SessionsTab } from "./sessions-tab";
import { SettingsTab } from "./settings-tab";
import { SetupScreen } from "./setup-screen";

export function OperatorOperationsPage() {
	const sessionState = authClient.useSession();
	const [activeTab, setActiveTab] = useState<TabId>("home");
	const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
	const [receiptPreview, setReceiptPreview] = useState<ReceiptPreview | null>(
		null,
	);
	const [receiptSessionId, setReceiptSessionId] = useState<string | null>(null);

	const operatorContextQuery = useQuery({
		enabled: Boolean(sessionState.data?.session),
		queryKey: ["operator-context", sessionState.data?.user?.id],
		queryFn: async () =>
			unwrapApiResult<OperatorContext>(await eden.operator.context.get()),
	});

	const operatorContext = operatorContextQuery.data ?? null;

	useEffect(() => {
		if (operatorContext?.selectedParkingLotId) {
			setSelectedLotId(operatorContext.selectedParkingLotId);
		}
	}, [operatorContext?.selectedParkingLotId]);

	const sessionsQuery = useQuery({
		enabled: Boolean(selectedLotId && operatorContext?.workspaceReady),
		queryKey: ["operator-sessions", selectedLotId],
		queryFn: async () =>
			unwrapApiResult<SessionLists>(
				await eden.operator.sessions.get({
					query: { parkingLotId: selectedLotId ?? undefined },
				}),
			),
	});

	const handleSelectSession = () => {
		setActiveTab("gate");
	};

	const handleReceiptReady = (preview: ReceiptPreview, sessionId: string) => {
		setReceiptPreview(preview);
		setReceiptSessionId(sessionId);
	};

	const handleDismissReceipt = () => {
		setReceiptPreview(null);
		setReceiptSessionId(null);
	};

	// Loading auth state
	if (sessionState.isPending) {
		return (
			<div className="flex min-h-dvh items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-3">
					<div className="size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
					<p className="text-muted-foreground text-sm">Loading...</p>
				</div>
			</div>
		);
	}

	// Not authenticated
	if (!sessionState.data?.session) {
		return <AuthScreen onAuthenticated={() => sessionState.refetch()} />;
	}

	// Loading operator context
	if (operatorContextQuery.isPending) {
		return (
			<div className="flex min-h-dvh items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-3">
					<div className="size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
					<p className="text-muted-foreground text-sm">Loading workspace...</p>
				</div>
			</div>
		);
	}

	// Workspace not ready - needs setup
	if (!operatorContext?.workspaceReady) {
		return <SetupScreen userName={sessionState.data?.user?.name ?? null} />;
	}

	// Main app
	return (
		<>
			<OperatorShell activeTab={activeTab} onTabChange={setActiveTab}>
				{activeTab === "home" && (
					<DashboardTab
						onNavigate={setActiveTab}
						onSelectLot={setSelectedLotId}
						operatorContext={operatorContext}
						selectedLotId={selectedLotId}
						sessions={sessionsQuery.data ?? null}
					/>
				)}

				{activeTab === "gate" && (
					<GateTab
						onReceiptReady={handleReceiptReady}
						operatorContext={operatorContext}
						selectedLotId={selectedLotId}
					/>
				)}

				{activeTab === "sessions" && (
					<SessionsTab
						baseRate={
							operatorContext.allowedLots.find((l) => l.id === selectedLotId)
								?.baseRate ?? 0
						}
						isLoading={sessionsQuery.isPending}
						onReceiptReady={handleReceiptReady}
						onSelectSession={handleSelectSession}
						sessions={sessionsQuery.data ?? null}
					/>
				)}

				{activeTab === "settings" && (
					<SettingsTab
						onSelectLot={setSelectedLotId}
						operatorContext={operatorContext}
						selectedLotId={selectedLotId}
					/>
				)}
			</OperatorShell>

			{/* Receipt overlay */}
			{receiptPreview && receiptSessionId && (
				<ReceiptOverlay
					onDismiss={handleDismissReceipt}
					preview={receiptPreview}
					sessionId={receiptSessionId}
				/>
			)}
		</>
	);
}
