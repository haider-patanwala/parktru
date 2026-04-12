import type { Metadata } from "next";

import { LandingPage } from "@/features/marketing";

export const metadata: Metadata = {
	title: "ParkTru — Parking operations for operators",
	description:
		"Fast, offline-ready parking management: sessions, gate workflows, reports, and receipt capture in one operator console.",
	openGraph: {
		title: "ParkTru — Parking operations for operators",
		description: "Fast, offline-ready parking management for on-site teams.",
	},
};

export default function Home() {
	return <LandingPage />;
}
