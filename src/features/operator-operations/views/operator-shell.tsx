"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TabId = "home" | "gate" | "sessions" | "reports" | "settings";

interface OperatorShellProps {
	activeTab: TabId;
	onTabChange: (tab: TabId) => void;
	children: ReactNode;
}

function TabIcon({ tab, active }: { tab: TabId; active: boolean }) {
	const color = active ? "text-primary" : "text-muted-foreground";

	switch (tab) {
		case "home":
			return (
				<svg
					className={cn("size-6", color)}
					fill="none"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={active ? 2.2 : 1.8}
					viewBox="0 0 24 24"
				>
					<path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
					{active && <path d="M9 21V14h6v7" />}
				</svg>
			);
		case "gate":
			return (
				<svg
					className={cn("size-6", color)}
					fill="none"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={active ? 2.2 : 1.8}
					viewBox="0 0 24 24"
				>
					<rect height="12" rx="2" width="18" x="3" y="6" />
					<path d="M7 12h4M15 10v4" />
					{active && <circle cx="15" cy="12" fill="currentColor" r="0.5" />}
				</svg>
			);
		case "sessions":
			return (
				<svg
					className={cn("size-6", color)}
					fill="none"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={active ? 2.2 : 1.8}
					viewBox="0 0 24 24"
				>
					<path d="M4 6h16M4 12h16M4 18h10" />
				</svg>
			);
		case "reports":
			return (
				<svg
					className={cn("size-6", color)}
					fill="none"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={active ? 2.2 : 1.8}
					viewBox="0 0 24 24"
				>
					<path d="M4 19V5M12 19V9M20 19v-6" />
				</svg>
			);
		case "settings":
			return (
				<svg
					className={cn("size-6", color)}
					fill="none"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={active ? 2.2 : 1.8}
					viewBox="0 0 24 24"
				>
					<circle cx="12" cy="12" r="3" />
					<path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
				</svg>
			);
	}
}

const TAB_LABELS: Record<TabId, string> = {
	home: "Home",
	gate: "Gate",
	sessions: "Parked",
	reports: "Reports",
	settings: "Settings",
};

const TAB_ORDER: TabId[] = ["home", "gate", "sessions", "reports", "settings"];

export function OperatorShell({
	activeTab,
	onTabChange,
	children,
}: OperatorShellProps) {
	return (
		<div className="flex min-h-dvh flex-col bg-background">
			{/* Main content area */}
			<main className="flex-1 overflow-y-auto pb-20">{children}</main>

			{/* Bottom tab bar */}
			<nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-border border-t bg-background/80 backdrop-blur-xl">
				<div className="mx-auto flex max-w-xl">
					{TAB_ORDER.map((tab) => {
						const isActive = activeTab === tab;
						return (
							<button
								className={cn(
									"relative flex flex-1 flex-col items-center gap-0.5 pt-3 pb-2 transition-colors",
									isActive
										? "text-primary"
										: "text-muted-foreground active:text-foreground",
								)}
								key={tab}
								onClick={() => onTabChange(tab)}
								type="button"
							>
								{isActive && (
									<span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
								)}
								<TabIcon active={isActive} tab={tab} />
								<span
									className={cn(
										"max-w-[4.25rem] truncate text-center font-medium text-[0.6rem] leading-tight sm:max-w-none sm:text-[0.65rem]",
										isActive ? "text-primary" : "text-muted-foreground",
									)}
								>
									{TAB_LABELS[tab]}
								</span>
							</button>
						);
					})}
				</div>
			</nav>
		</div>
	);
}
