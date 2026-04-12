import Link from "next/link";

import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

const features = [
	{
		title: "Offline-first operations",
		description:
			"Keep the lane moving when connectivity drops. Core workflows stay usable with a clear path back to live data when you are online again.",
		icon: IconCloudOff,
	},
	{
		title: "Sessions & gate in one flow",
		description:
			"Track active vehicles, handle exceptions, and move between dashboard, gate, and session detail without losing context.",
		icon: IconLanes,
	},
	{
		title: "Reports you can trust",
		description:
			"Summaries and exports that match what happened on the ground—built for handoff to finance and site leads.",
		icon: IconChart,
	},
	{
		title: "Receipt capture",
		description:
			"Pull text from paper and digital receipts so amounts and metadata land where operators expect them.",
		icon: IconReceipt,
	},
] as const;

export function LandingPage() {
	return (
		<div className='flex min-h-screen flex-col bg-background text-foreground'>
			<header className='sticky top-0 z-10 border-border/70 border-b bg-surface/85 backdrop-blur-md'>
				<div className='mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6'>
					<Link
						className='font-heading font-semibold text-base tracking-tight'
						href='/'>
						ParkTru
					</Link>
					<nav className='flex items-center gap-2 sm:gap-3'>
						<Link
							className='rounded-4xl px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground'
							href='#features'>
							Features
						</Link>
						<Link
							className='inline-flex h-9 items-center justify-center rounded-4xl bg-primary px-4 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/85'
							href='/operator'>
							Open console
						</Link>
					</nav>
				</div>
			</header>

			<main>
				<section className='relative overflow-hidden border-border/60 border-b'>
					<div
						aria-hidden
						className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.92_0.04_186/0.35),transparent)]'
					/>
					<div className='relative mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-20 sm:pb-28'>
						<p className='font-medium text-muted-foreground text-xs uppercase tracking-[0.22em]'>
							Operator operations
						</p>
						<h1 className='mt-4 max-w-3xl font-heading font-semibold text-4xl tracking-tight sm:text-5xl sm:leading-[1.1]'>
							Parking operations, calm and fast at the curb
						</h1>
						<p className='mt-5 max-w-2xl text-lg text-muted-foreground leading-relaxed'>
							ParkTru is a focused console for on-site teams: sessions, gate
							activity, reporting, and receipt capture—without the noise of a
							generic back office suite.
						</p>
						<div className='mt-10 flex flex-wrap items-center gap-3'>
							<Link
								className='inline-flex h-11 items-center justify-center rounded-4xl bg-primary px-6 font-medium text-base text-primary-foreground shadow-sm transition-colors hover:bg-primary/85'
								href='/operator'>
								Go to operator console
							</Link>
							<Link
								className='inline-flex h-11 items-center justify-center rounded-4xl border border-border bg-surface px-6 font-medium text-base text-foreground transition-colors hover:bg-muted'
								href='#features'>
								See what&apos;s inside
							</Link>
						</div>
						<p className='mt-8 max-w-xl text-muted-foreground text-sm leading-relaxed'>
							<strong className='font-medium text-foreground'>
								Installed app?
							</strong>{" "}
							Your PWA home opens the operator console—this page is for
							discovering the product in the browser.
						</p>
					</div>
				</section>

				<section
					className='mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20'
					id='features'>
					<div className='max-w-2xl'>
						<h2 className='font-heading font-semibold text-2xl tracking-tight sm:text-3xl'>
							Built for the people running the lot
						</h2>
						<p className='mt-3 text-muted-foreground leading-relaxed'>
							Each area of the product is tuned for quick scanning, fewer taps,
							and obvious next steps—whether you are covering a single gate or a
							full site.
						</p>
					</div>
					<div className='mt-12 grid gap-5 sm:grid-cols-2'>
						{features.map((item) => (
							<Card
								className='border-border/80 shadow-sm'
								key={item.title}>
								<CardHeader className='gap-4'>
									<div className='flex items-start gap-4'>
										<span
											aria-hidden
											className='flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground'>
											<item.icon />
										</span>
										<div className='min-w-0 space-y-1.5'>
											<CardTitle className='text-lg'>{item.title}</CardTitle>
											<CardDescription className='text-base leading-relaxed'>
												{item.description}
											</CardDescription>
										</div>
									</div>
								</CardHeader>
							</Card>
						))}
					</div>
				</section>

				<section className='border-border/60 border-t bg-surface-secondary/50'>
					<div className='mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:flex-row sm:items-center sm:px-6'>
						<div>
							<h2 className='font-heading font-semibold text-xl tracking-tight'>
								Ready when your team is
							</h2>
							<p className='mt-2 max-w-xl text-muted-foreground leading-relaxed'>
								Jump into the console to manage live sessions and site settings.
							</p>
						</div>
						<Link
							className='inline-flex h-11 shrink-0 items-center justify-center rounded-4xl bg-primary px-6 font-medium text-base text-primary-foreground transition-colors hover:bg-primary/85'
							href='/operator'>
							Open operator console
						</Link>
					</div>
				</section>
			</main>

			<footer className='mt-auto border-border/60 border-t py-8'>
				<div className='mx-auto flex max-w-6xl flex-col gap-2 px-4 text-muted-foreground text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6'>
					<p>© {new Date().getFullYear()} ParkTru</p>
					<p className='max-w-md leading-relaxed sm:text-end'>
						Progressive web app install uses the operator console as its start
						screen so shortcuts stay operational, not promotional.
					</p>
				</div>
			</footer>
		</div>
	);
}

function IconCloudOff() {
	return (
		<svg
			className='size-5'
			fill='none'
			focusable='false'
			role='presentation'
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.75}
			viewBox='0 0 24 24'>
			<title>Offline-first</title>
			<path d='M12 3v4M4.5 9.5h2M17.5 9.5h2M6 17h12a4 4 0 0 0 .2-8 5.5 5.5 0 0 0-10.8 1.5A4 4 0 0 0 6 17Z' />
			<path d='m3 21 18-18' />
		</svg>
	);
}

function IconLanes() {
	return (
		<svg
			className='size-5'
			fill='none'
			focusable='false'
			role='presentation'
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.75}
			viewBox='0 0 24 24'>
			<title>Gate and sessions</title>
			<path d='M4 19V5M20 19V5M8 19v-4M12 19V9M16 19v-7' />
		</svg>
	);
}

function IconChart() {
	return (
		<svg
			className='size-5'
			fill='none'
			focusable='false'
			role='presentation'
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.75}
			viewBox='0 0 24 24'>
			<title>Reports</title>
			<path d='M4 19h16M7 15l3-4 3 2 4-6M4 4v15' />
		</svg>
	);
}

function IconReceipt() {
	return (
		<svg
			className='size-5'
			fill='none'
			focusable='false'
			role='presentation'
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.75}
			viewBox='0 0 24 24'>
			<title>Receipt capture</title>
			<path d='M7 3h10v18l-2-1-2 1-2-1-2 1-2-1-2 1V3Z' />
			<path d='M9 7h6M9 11h6M9 15h4' />
		</svg>
	);
}
