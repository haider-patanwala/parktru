"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePwaInstall } from "../pwa-install-context";

export function InstallPwaNotice() {
	const pathname = usePathname();
	const { variant, isVisible, isInstalling, dismiss, installApp } =
		usePwaInstall();

	if (!variant || !isVisible || pathname === "/") {
		return null;
	}

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
