"use client";

import { ToastProvider } from "@heroui/react";
import { SerwistProvider } from "@serwist/next/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const [queryClient] = useState(() => new QueryClient());

	return (
		<SerwistProvider swUrl="/sw.js">
			<QueryClientProvider client={queryClient}>
				{children}
				<ToastProvider placement="top" />
			</QueryClientProvider>
		</SerwistProvider>
	);
}
