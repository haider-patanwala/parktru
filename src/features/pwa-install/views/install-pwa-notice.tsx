"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "parktru:pwa-install-dismissed-at";
const DISMISS_WINDOW_MS = 1000 * 60 * 60 * 24 * 7;

interface BeforeInstallPromptEvent extends Event {
	platforms: string[];
	prompt: () => Promise<void>;
	userChoice: Promise<{
		outcome: "accepted" | "dismissed";
		platform: string;
	}>;
}

type InstallVariant = "browser-prompt" | "ios-browser" | "ios-safari";

function wasDismissedRecently() {
	if (typeof window === "undefined") {
		return false;
	}

	const dismissedAt = window.localStorage.getItem(DISMISS_KEY);
	if (!dismissedAt) {
		return false;
	}

	const timestamp = Number(dismissedAt);
	return (
		Number.isFinite(timestamp) && Date.now() - timestamp < DISMISS_WINDOW_MS
	);
}

function markDismissed() {
	window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
}

function isStandalone() {
	const navigatorWithStandalone = window.navigator as Navigator & {
		standalone?: boolean;
	};

	return (
		window.matchMedia("(display-mode: standalone)").matches ||
		navigatorWithStandalone.standalone === true
	);
}

function detectInstallVariant(): InstallVariant | null {
	if (isStandalone() || wasDismissedRecently()) {
		return null;
	}

	const userAgent = window.navigator.userAgent;
	const isIOS =
		/iPad|iPhone|iPod/.test(userAgent) ||
		(window.navigator.platform === "MacIntel" &&
			window.navigator.maxTouchPoints > 1);

	if (!isIOS) {
		return null;
	}

	const isSafari =
		/Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);

	return isSafari ? "ios-safari" : "ios-browser";
}

export function InstallPwaNotice() {
	const [variant, setVariant] = useState<InstallVariant | null>(null);
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const [isVisible, setIsVisible] = useState(false);
	const [isInstalling, setIsInstalling] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const syncVisibility = () => {
			const nextVariant = deferredPrompt
				? "browser-prompt"
				: detectInstallVariant();
			setVariant(nextVariant);
			setIsVisible(Boolean(nextVariant));
		};

		const handleBeforeInstallPrompt = (event: Event) => {
			const promptEvent = event as BeforeInstallPromptEvent;
			promptEvent.preventDefault();

			if (isStandalone() || wasDismissedRecently()) {
				return;
			}

			setDeferredPrompt(promptEvent);
			setVariant("browser-prompt");
			setIsVisible(true);
		};

		const handleInstalled = () => {
			window.localStorage.removeItem(DISMISS_KEY);
			setDeferredPrompt(null);
			setVariant(null);
			setIsVisible(false);
			setIsInstalling(false);
		};

		const mediaQuery = window.matchMedia("(display-mode: standalone)");
		const handleDisplayModeChange = (event: MediaQueryListEvent) => {
			if (event.matches) {
				handleInstalled();
			}
		};

		syncVisibility();
		window.addEventListener(
			"beforeinstallprompt",
			handleBeforeInstallPrompt as EventListener,
		);
		window.addEventListener("appinstalled", handleInstalled);
		if (typeof mediaQuery.addEventListener === "function") {
			mediaQuery.addEventListener("change", handleDisplayModeChange);
		} else {
			mediaQuery.addListener(handleDisplayModeChange);
		}

		return () => {
			window.removeEventListener(
				"beforeinstallprompt",
				handleBeforeInstallPrompt as EventListener,
			);
			window.removeEventListener("appinstalled", handleInstalled);
			if (typeof mediaQuery.removeEventListener === "function") {
				mediaQuery.removeEventListener("change", handleDisplayModeChange);
			} else {
				mediaQuery.removeListener(handleDisplayModeChange);
			}
		};
	}, [deferredPrompt]);

	if (!variant || !isVisible) {
		return null;
	}

	const dismiss = () => {
		markDismissed();
		setDeferredPrompt(null);
		setVariant(null);
		setIsVisible(false);
	};

	const installApp = async () => {
		if (!deferredPrompt) {
			return;
		}

		setIsInstalling(true);

		try {
			await deferredPrompt.prompt();
			const { outcome } = await deferredPrompt.userChoice;
			setDeferredPrompt(null);

			if (outcome === "accepted") {
				setVariant(null);
				setIsVisible(false);
				return;
			}

			markDismissed();
			setVariant(null);
			setIsVisible(false);
		} finally {
			setIsInstalling(false);
		}
	};

	return (
		<div className='pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-6'>
			<section
				aria-live='polite'
				className='pointer-events-auto w-full max-w-md rounded-[1rem] border border-border/80 bg-background/95 p-4 text-foreground shadow-black/5 shadow-xl backdrop-blur-xl'
				role='status'>
				<div className='flex items-start gap-3'>
					<div className='mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary'>
						<svg
							aria-hidden='true'
							className='size-5'
							fill='none'
							stroke='currentColor'
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth='1.8'
							viewBox='0 0 24 24'>
							<path d='M12 3v12' />
							<path d='M8 11l4 4 4-4' />
							<path d='M5 21h14' />
						</svg>
					</div>

					<div className='min-w-0 flex-1'>
						<p className='font-semibold text-[0.95rem]'>
							{variant === "browser-prompt"
								? "Install ParkTru"
								: variant === "ios-safari"
									? "Add ParkTru to Home Screen"
									: "Open Safari to install ParkTru"}
						</p>
						<p className='mt-1 text-pretty text-muted-foreground text-sm'>
							{variant === "browser-prompt"
								? "Keep ParkTru on the home screen for faster launch and a cleaner, app-like experience."
								: variant === "ios-safari"
									? "Tap Share in Safari, then choose Add to Home Screen to install ParkTru as an app."
									: "Home Screen install on iPhone works through Safari. Open this page there, then use Add to Home Screen."}
						</p>

						{variant === "ios-safari" && (
							<div className='mt-3 flex flex-wrap gap-2 text-xs'>
								<span className='rounded-full bg-primary/10 px-3 py-1 font-medium text-primary'>
									1. Tap Share
								</span>
								<span className='rounded-full bg-primary/10 px-3 py-1 font-medium text-primary'>
									2. Add to Home Screen
								</span>
							</div>
						)}

						<div
							className={cn(
								"mt-4 flex flex-wrap items-center gap-2",
								variant === "browser-prompt" ? "justify-start" : "justify-end",
							)}>
							{variant === "browser-prompt" && (
								<Button
									disabled={isInstalling}
									onClick={installApp}
									size='sm'
									type='button'>
									{isInstalling ? "Opening…" : "Install app"}
								</Button>
							)}
							<Button
								onClick={dismiss}
								size='sm'
								type='button'
								variant='outline'>
								{variant === "browser-prompt" ? "Not now" : "Dismiss"}
							</Button>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
