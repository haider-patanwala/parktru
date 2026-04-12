"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

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

type PwaInstallContextValue = {
	variant: InstallVariant | null;
	isVisible: boolean;
	isInstalling: boolean;
	dismiss: () => void;
	installApp: () => Promise<void>;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

export function PwaInstallProvider({ children }: { children: ReactNode }) {
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

	const dismiss = useCallback(() => {
		markDismissed();
		setDeferredPrompt(null);
		setVariant(null);
		setIsVisible(false);
	}, []);

	const installApp = useCallback(async () => {
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
	}, [deferredPrompt]);

	const value = useMemo(
		() => ({
			variant,
			isVisible,
			isInstalling,
			dismiss,
			installApp,
		}),
		[variant, isVisible, isInstalling, dismiss, installApp],
	);

	return (
		<PwaInstallContext.Provider value={value}>
			{children}
		</PwaInstallContext.Provider>
	);
}

export function usePwaInstall() {
	const ctx = useContext(PwaInstallContext);
	if (!ctx) {
		throw new Error("usePwaInstall must be used within PwaInstallProvider");
	}
	return ctx;
}
