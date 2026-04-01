import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "ParkTru",
		short_name: "ParkTru",
		description: "Fast, offline-ready parking management for operators",
		id: "/",
		start_url: "/",
		scope: "/",
		display: "standalone",
		background_color: "#F4F5F5FF",
		theme_color: "#F4F5F5FF",
		orientation: "portrait",
		lang: "en-US",
		icons: [
			{
				src: "/icon-192x192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "maskable",
			},
			{
				src: "/icon-512x512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
			{
				src: "/apple-touch-icon.png",
				sizes: "180x180",
				type: "image/png",
			},
		],
	};
}
