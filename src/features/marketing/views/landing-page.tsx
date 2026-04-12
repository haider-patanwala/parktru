import Link from "next/link";

import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { LandingInstallCallout } from "@/features/pwa-install";

const features = [
	{
		title: "Keeps working when the network doesn’t",
		description:
			"Spotty signal should not stop the lane. The essentials stay at your fingertips, then sync cleanly once you are back online.",
		icon: IconCloudOff,
	},
	{
		title: "Gate, lane, and detail—connected",
		description:
			"See who is in, handle exceptions, and drill into a session without hunting across tabs or losing your place.",
		icon: IconLanes,
	},
	{
		title: "Numbers that match the shift",
		description:
			"Summaries and exports that line up with what your team actually did—ready for finance, leads, and end-of-day closeout.",
		icon: IconChart,
	},
	{
		title: "Receipts without the retyping",
		description:
			"Snap or upload receipts and let the busy work happen in the background—amounts land where your team already works.",
		icon: IconReceipt,
	},
] as const;

export function LandingPage() {
	return (
		<div className="flex min-h-dvh flex-col overflow-x-hidden bg-background text-foreground">
			<header className="sticky top-0 z-10 border-border/70 border-b bg-surface/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
				<div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
					<Link
						className="min-w-0 shrink font-heading font-semibold text-base tracking-tight"
						href="/"
					>
						ParkTru
					</Link>
					<nav className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
						<Link
							className="touch-manipulation rounded-4xl px-2.5 py-2 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground sm:px-3 sm:py-1.5"
							href="#features"
						>
							Features
						</Link>
						<Link
							className="inline-flex h-10 touch-manipulation items-center justify-center rounded-4xl bg-primary px-3 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/85 sm:h-9 sm:px-4"
							href="/operator"
						>
							<span className="inline max-[380px]:hidden">Open workspace</span>
							<span className="hidden max-[380px]:inline">Workspace</span>
						</Link>
					</nav>
				</div>
			</header>

			<main>
				<section className="relative overflow-hidden border-border/60 border-b">
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.92_0.04_186/0.35),transparent)]"
					/>
					<div className="relative mx-auto max-w-6xl px-[max(1rem,env(safe-area-inset-left))] pt-12 pr-[max(1rem,env(safe-area-inset-right))] pb-16 sm:px-6 sm:pt-16 sm:pb-20 md:pt-20 md:pb-28 lg:pt-24">
						<p className="font-medium text-[0.6875rem] text-muted-foreground uppercase tracking-[0.22em] sm:text-xs">
							For teams at the curb
						</p>
						<h1 className="mt-3 max-w-[min(100%,34ch)] text-balance font-heading font-semibold text-[clamp(1.75rem,5.5vw,3.5rem)] leading-[1.12] tracking-tight sm:mt-4 sm:max-w-3xl sm:leading-[1.1] lg:text-6xl">
							Curbside parking, without the scramble
						</h1>
						<p className="mt-4 max-w-2xl text-base text-muted-foreground leading-relaxed sm:mt-5 sm:text-lg">
							ParkTru gives your crew one place to run the shift: who is in,
							what needs attention, and what to hand off when the day ends—so
							nothing important lives in a side spreadsheet or a group chat.
						</p>
						<div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center">
							<Link
								className="inline-flex h-12 w-full touch-manipulation items-center justify-center rounded-4xl bg-primary px-6 font-medium text-base text-primary-foreground shadow-sm transition-colors hover:bg-primary/85 sm:h-11 sm:w-auto sm:min-w-50"
								href="/operator"
							>
								Open your workspace
							</Link>
							<Link
								className="inline-flex h-12 w-full touch-manipulation items-center justify-center rounded-4xl border border-border bg-surface px-6 font-medium text-base text-foreground transition-colors hover:bg-muted sm:h-11 sm:w-auto sm:min-w-50"
								href="#features"
							>
								See what&apos;s inside
							</Link>
						</div>
						<LandingInstallCallout />
						<p className="mt-6 max-w-xl text-muted-foreground text-sm leading-relaxed sm:mt-8">
							<strong className="font-medium text-foreground">
								Already added ParkTru to your home screen?
							</strong>{" "}
							That shortcut opens your workspace directly—this page is for
							learning what ParkTru does before you dive in.
						</p>
					</div>
				</section>

				<section
					className="mx-auto max-w-6xl scroll-mt-[calc(3.5rem+env(safe-area-inset-top))] px-[max(1rem,env(safe-area-inset-left))] py-14 pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:py-20 lg:py-24"
					id="features"
				>
					<div className="max-w-2xl">
						<h2 className="text-balance font-heading font-semibold text-2xl tracking-tight sm:text-3xl">
							Designed for the person holding the tablet
						</h2>
						<p className="mt-3 text-muted-foreground leading-relaxed">
							Large type, clear states, and the next action up front—whether you
							are covering one gate or an entire site.
						</p>
					</div>
					<div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:gap-6">
						{features.map((item) => (
							<Card className="border-border/80 shadow-sm" key={item.title}>
								<CardHeader className="gap-3 px-5 sm:gap-4 sm:px-6">
									<div className="flex items-start gap-3 sm:gap-4">
										<span
											aria-hidden
											className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground sm:size-11"
										>
											<item.icon />
										</span>
										<div className="min-w-0 space-y-1.5">
											<CardTitle className="text-base leading-snug sm:text-lg">
												{item.title}
											</CardTitle>
											<CardDescription className="text-[0.9375rem] leading-relaxed sm:text-base">
												{item.description}
											</CardDescription>
										</div>
									</div>
								</CardHeader>
							</Card>
						))}
					</div>
				</section>

				<section className="border-border/60 border-t bg-surface-secondary/50">
					<div className="mx-auto flex max-w-6xl flex-col items-stretch justify-between gap-6 px-[max(1rem,env(safe-area-inset-left))] py-12 pr-[max(1rem,env(safe-area-inset-right))] sm:flex-row sm:items-center sm:gap-8 sm:px-6 sm:py-14 lg:py-16">
						<div className="min-w-0">
							<h2 className="text-balance font-heading font-semibold text-xl tracking-tight sm:text-2xl">
								Start the next shift in one tap
							</h2>
							<p className="mt-2 max-w-xl text-muted-foreground leading-relaxed">
								Pick up live sessions, handle what needs eyes on it, and adjust
								site settings without a training deck.
							</p>
						</div>
						<Link
							className="inline-flex h-12 w-full shrink-0 touch-manipulation items-center justify-center rounded-4xl bg-primary px-6 font-medium text-base text-primary-foreground transition-colors hover:bg-primary/85 sm:h-11 sm:w-auto sm:min-w-50"
							href="/operator"
						>
							Open your workspace
						</Link>
					</div>
				</section>
			</main>

			<footer className="mt-auto border-border/60 border-t pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
				<div className="mx-auto flex max-w-6xl flex-col gap-4 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] text-muted-foreground text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
					<p>© {new Date().getFullYear()} ParkTru</p>
					<p className="max-w-md text-balance leading-relaxed sm:text-end">
						Home screen shortcuts open straight into your workspace—not a
						marketing page—so the team lands where the work is.
					</p>
				</div>
			</footer>
		</div>
	);
}

function IconCloudOff() {
	return (
		<svg
			className="size-5"
			fill="none"
			focusable="false"
			role="presentation"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={1.75}
			viewBox="0 0 24 24"
		>
			<title>Works offline</title>
			<path d="M12 3v4M4.5 9.5h2M17.5 9.5h2M6 17h12a4 4 0 0 0 .2-8 5.5 5.5 0 0 0-10.8 1.5A4 4 0 0 0 6 17Z" />
			<path d="m3 21 18-18" />
		</svg>
	);
}

function IconLanes() {
	return (
		<svg
			className="size-5"
			fill="none"
			focusable="false"
			role="presentation"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={1.75}
			viewBox="0 0 24 24"
		>
			<title>Gate and sessions flow</title>
			<path d="M4 19V5M20 19V5M8 19v-4M12 19V9M16 19v-7" />
		</svg>
	);
}

function IconChart() {
	return (
		<svg
			className="size-5"
			fill="none"
			focusable="false"
			role="presentation"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={1.75}
			viewBox="0 0 24 24"
		>
			<title>Reports</title>
			<path d="M4 19h16M7 15l3-4 3 2 4-6M4 4v15" />
		</svg>
	);
}

function IconReceipt() {
	return (
		<svg
			className="size-5"
			fill="none"
			focusable="false"
			role="presentation"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={1.75}
			viewBox="0 0 24 24"
		>
			<title>Receipts</title>
			<path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1-2 1V3Z" />
			<path d="M9 7h6M9 11h6M9 15h4" />
		</svg>
	);
}
