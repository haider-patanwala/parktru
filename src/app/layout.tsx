import "@/styles/globals.css";

import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { QueryProvider } from "@/app/providers";

const APP_NAME = "Parktru";
const APP_DESCRIPTION = "Parktru is a platform for parking your car";

export const metadata: Metadata = {
	applicationName: APP_NAME,
	title: {
		default: APP_NAME,
		template: "%s - NJS App",
	},
	description: APP_DESCRIPTION,
	icons: [{ rel: "icon", url: "/favicon.ico" }],
	manifest: "/manifest.json",
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: APP_NAME,
	},
	formatDetection: {
		telephone: false,
	},
};

export const viewport: Viewport = {
	themeColor: "#000000",
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html className={`${geist.variable}`} lang="en">
			<body>
				<QueryProvider>{children}</QueryProvider>
			</body>
		</html>
	);
}
