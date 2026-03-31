export default function OfflinePage() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-linear-to-b from-neutral-50 to-white px-6 py-16 text-neutral-950">
			<section className="flex w-full max-w-xl flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
				<p className="font-medium text-neutral-500 text-sm uppercase tracking-[0.2em]">
					Offline
				</p>
				<h1 className="font-semibold text-3xl">You are offline right now</h1>
				<p className="text-base text-neutral-600">
					Parktru could not reach the network. Reconnect and refresh to keep
					browsing live data.
				</p>
				<p className="text-neutral-500 text-sm">
					This page is served by the service worker as a document fallback when
					a navigation request fails offline.
				</p>
			</section>
		</main>
	);
}
