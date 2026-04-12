"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePwaInstall } from "../pwa-install-context";

export function LandingInstallCallout() {
	const { variant, isVisible, isInstalling, dismiss, installApp } =
		usePwaInstall();

	if (!variant || !isVisible) {
		return null;
	}

	return (
		<div
			aria-live="polite"
			className="mt-8 w-full max-w-2xl rounded-[1.25rem] border border-border/80 bg-surface/90 p-4 text-foreground shadow-sm backdrop-blur-sm sm:p-5"
			role="status"
		>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
				<div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary sm:size-12">
					<svg
						aria-hidden="true"
						className="size-6"
						fill="none"
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="1.8"
						viewBox="0 0 24 24"
					>
						<path d="M12 3v12" />
						<path d="M8 11l4 4 4-4" />
						<path d="M5 21h14" />
					</svg>
				</div>

				<div className="min-w-0 flex-1">
					<p className="font-heading font-semibold text-base tracking-tight sm:text-lg">
						{variant === "browser-prompt"
							? "Install ParkTru"
							: variant === "ios-safari"
								? "Add ParkTru to Home Screen"
								: "Open Safari to install ParkTru"}
					</p>
					<p className="mt-2 text-muted-foreground text-sm leading-relaxed">
						{variant === "browser-prompt"
							? "Add ParkTru for one-tap launch and a focused, full-screen view—ideal on tablets at the gate."
							: variant === "ios-safari"
								? "Tap Share in Safari, then choose Add to Home Screen to install ParkTru as an app."
								: "Home Screen install on iPhone works through Safari. Open this page there, then use Add to Home Screen."}
					</p>

					{variant === "ios-safari" && (
						<div className="mt-3 flex flex-wrap gap-2 text-xs">
							<span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
								1. Tap Share
							</span>
							<span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
								2. Add to Home Screen
							</span>
						</div>
					)}

					<div
						className={cn(
							"mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2",
							variant === "browser-prompt"
								? "sm:justify-start"
								: "sm:justify-end",
						)}
					>
						{variant === "browser-prompt" && (
							<Button
								className="h-11 w-full touch-manipulation sm:h-10 sm:w-auto"
								disabled={isInstalling}
								onClick={installApp}
								size="default"
								type="button"
							>
								{isInstalling ? "Opening…" : "Install app"}
							</Button>
						)}
						<Button
							className="h-11 w-full touch-manipulation sm:h-10 sm:w-auto"
							onClick={dismiss}
							size="default"
							type="button"
							variant="outline"
						>
							{variant === "browser-prompt" ? "Not now" : "Dismiss"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
