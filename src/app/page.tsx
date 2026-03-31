import { getSession } from "@/server/better-auth/server";

export default async function Home() {
	const session = await getSession();

	return (
		<main className='flex min-h-screen flex-col items-center justify-center bg-linear-to-b text-neutral-800'>
			<h1>Hello World</h1>
		</main>
	);
}
