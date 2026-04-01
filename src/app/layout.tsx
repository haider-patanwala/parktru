import "@/styles/globals.css";

import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Sans } from "next/font/google";
import { QueryProvider } from "@/app/providers";
import { cn } from "@/lib/utils";

const instrumentSans = Instrument_Sans({
	subsets: ["latin"],
	variable: "--font-sans",
});

const APP_NAME = "ParkTru";
const APP_DESCRIPTION = "Fast, offline-ready parking management for operators";

export const metadata: Metadata = {
	applicationName: APP_NAME,
	title: {
		default: APP_NAME,
		template: "%s - ParkTru",
	},
	description: APP_DESCRIPTION,
	manifest: "/manifest.webmanifest",
	icons: {
		apple: "/apple-touch-icon.png",
		icon: "/icon-192x192.png",
	},
	appleWebApp: {
		capable: true,
		statusBarStyle: "black-translucent",
		title: APP_NAME,
	},
	formatDetection: {
		telephone: false,
	},
};

export const viewport: Viewport = {
	themeColor: "#1a1a2e",
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
	viewportFit: "cover",
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html
			className={cn(geist.variable, "font-sans", instrumentSans.variable)}
			lang="en"
		>
			<body className="overscroll-none">
				<QueryProvider>{children}</QueryProvider>
			</body>
		</html>
	);
}
