"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
	moneyFormatFromLot,
	unwrapApiResult,
} from "@/features/operator-operations/lib/operator-operations.helpers";
import type {
	OperatorContext,
	ReceiptPreview,
	SessionLists,
} from "@/features/operator-operations/models/operator-operations.types";
import {
	persistOperatorContextFromServer,
	persistSessionListsFromServer,
} from "@/features/operator-operations/sync/operator.actions";
import {
	loadOperatorContext,
	loadSessionLists,
} from "@/features/operator-operations/sync/operator.store";
import { startOperatorSyncEngine } from "@/features/operator-operations/sync/operator.sync-engine";
import { eden } from "@/server/eden";
import { AuthScreen } from "./auth-screen";
import { DashboardTab } from "./dashboard-tab";
import { GateTab } from "./gate-tab";
import { OperatorShell, type TabId } from "./operator-shell";
import { ReceiptOverlay } from "./receipt-overlay";
import { ReportsTab } from "./reports-tab";
import { SessionsTab } from "./sessions-tab";
import { SettingsTab } from "./settings-tab";
import { SetupScreen } from "./setup-screen";
import { useOperatorAuth } from "./use-operator-auth";

const NETWORK_TIMEOUT_MS = 12_000;

function withNetworkTimeout<T>(promise: Promise<T>): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) => {
			setTimeout(
				() => reject(new Error("network-timeout")),
				NETWORK_TIMEOUT_MS,
			);
		}),
	]);
}

export function OperatorOperationsPage() {
	const sessionState = useOperatorAuth();
	const [activeTab, setActiveTab] = useState<TabId>("home");
	const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
	const [receiptPreview, setReceiptPreview] = useState<ReceiptPreview | null>(
		null,
	);
	const [receiptSessionId, setReceiptSessionId] = useState<string | null>(null);

	const userId = sessionState.data?.user?.id;

	useEffect(() => {
		startOperatorSyncEngine();
	}, []);

	const operatorContextQuery = useQuery({
		enabled: Boolean(sessionState.data?.session && userId),
		queryKey: ["operator-context", userId],
		queryFn: async () => {
			const localFirst =
				userId !== undefined ? await loadOperatorContext(userId) : undefined;
			if (typeof navigator !== "undefined" && !navigator.onLine && localFirst) {
				return localFirst;
			}
			try {
				const ctx = unwrapApiResult<OperatorContext>(
					await withNetworkTimeout(eden.operator.context.get()),
				);
				if (userId) {
					await persistOperatorContextFromServer(userId, ctx);
				}
				return ctx;
			} catch {
				if (localFirst) {
					return localFirst;
				}
				if (userId) {
					const local = await loadOperatorContext(userId);
					if (local) {
						return local;
					}
				}
				throw new Error("Could not load operator context.");
			}
		},
	});

	const operatorContext = operatorContextQuery.data ?? null;
	const selectedLotSummary =
		operatorContext?.allowedLots.find((l) => l.id === selectedLotId) ?? null;

	useEffect(() => {
		if (operatorContext?.selectedParkingLotId) {
			setSelectedLotId(operatorContext.selectedParkingLotId);
		}
	}, [operatorContext?.selectedParkingLotId]);

	const sessionsQuery = useQuery({
		enabled: Boolean(
			selectedLotId && operatorContext?.workspaceReady && userId,
		),
		queryKey: ["operator-sessions", selectedLotId, userId],
		queryFn: async () => {
			const listsLocalFirst =
				userId && selectedLotId
					? await loadSessionLists(userId, selectedLotId)
					: undefined;
			if (
				typeof navigator !== "undefined" &&
				!navigator.onLine &&
				listsLocalFirst
			) {
				return listsLocalFirst;
			}
			try {
				const lists = unwrapApiResult<SessionLists>(
					await withNetworkTimeout(
						eden.operator.sessions.get({
							query: { parkingLotId: selectedLotId ?? undefined },
						}),
					),
				);
				if (userId && selectedLotId) {
					await persistSessionListsFromServer(userId, selectedLotId, lists);
				}
				return lists;
			} catch {
				if (listsLocalFirst) {
					return listsLocalFirst;
				}
				if (userId && selectedLotId) {
					const local = await loadSessionLists(userId, selectedLotId);
					if (local) {
						return local;
					}
				}
				throw new Error("Could not load sessions.");
			}
		},
	});

	const handleReceiptReady = (preview: ReceiptPreview, sessionId: string) => {
		setReceiptPreview(preview);
		setReceiptSessionId(sessionId);
	};

	const handleDismissReceipt = () => {
		setReceiptPreview(null);
		setReceiptSessionId(null);
	};

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

	if (!sessionState.data?.session) {
		return <AuthScreen onAuthenticated={() => sessionState.refetch()} />;
	}

	if (operatorContextQuery.isPending && !operatorContext) {
		return (
			<div className="flex min-h-dvh items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-3">
					<div className="size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
					<p className="text-muted-foreground text-sm">Loading workspace...</p>
				</div>
			</div>
		);
	}

	if (!operatorContext?.workspaceReady) {
		return (
			<SetupScreen
				userId={userId ?? ""}
				userName={sessionState.data?.user?.name ?? null}
			/>
		);
	}

	return (
		<>
			<OperatorShell activeTab={activeTab} onTabChange={setActiveTab}>
				{activeTab === "home" && (
					<DashboardTab
						onNavigate={setActiveTab}
						onReceiptReady={handleReceiptReady}
						onSelectLot={setSelectedLotId}
						operatorContext={operatorContext}
						selectedLotId={selectedLotId}
						sessions={sessionsQuery.data ?? null}
						userId={userId ?? ""}
					/>
				)}

				{activeTab === "gate" && (
					<GateTab
						onReceiptReady={handleReceiptReady}
						operatorContext={operatorContext}
						selectedLotId={selectedLotId}
						userId={userId ?? ""}
					/>
				)}

				{activeTab === "sessions" && (
					<SessionsTab
						baseRate={selectedLotSummary?.baseRate ?? 0}
						isLoading={sessionsQuery.isPending}
						moneyFormat={moneyFormatFromLot(selectedLotSummary)}
						onReceiptReady={handleReceiptReady}
						operatorContext={operatorContext}
						parkingLotName={selectedLotSummary?.name ?? "Parking lot"}
						sessions={sessionsQuery.data ?? null}
						userId={userId ?? ""}
					/>
				)}

				{activeTab === "reports" && (
					<ReportsTab
						onReceiptReady={handleReceiptReady}
						onSelectLot={setSelectedLotId}
						operatorContext={operatorContext}
						selectedLotId={selectedLotId}
						userId={userId ?? ""}
					/>
				)}

				{activeTab === "settings" && (
					<SettingsTab
						onSelectLot={setSelectedLotId}
						operatorContext={operatorContext}
						selectedLotId={selectedLotId}
						userId={userId ?? ""}
					/>
				)}
			</OperatorShell>

			{receiptPreview && receiptSessionId && (
				<ReceiptOverlay
					onDismiss={handleDismissReceipt}
					operatorContext={operatorContext}
					preview={receiptPreview}
					sessionId={receiptSessionId}
					userId={userId ?? ""}
				/>
			)}
		</>
	);
}
