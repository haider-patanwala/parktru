export default function PwaDebugPage() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 py-16 text-neutral-950">
			<section className="w-full max-w-xl rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
				<p className="font-medium text-neutral-500 text-sm uppercase tracking-[0.2em]">
					PWA debug
				</p>
				<h1 className="mt-4 font-semibold text-3xl">Debug route restored</h1>
				<p className="mt-3 text-neutral-600">
					This placeholder keeps the existing app route surface intact while the
					operator workflow is being built.
				</p>
			</section>
		</main>
	);
}
