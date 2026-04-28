/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type {
	PrecacheEntry,
	RouteHandler,
	RouteMatchCallback,
	SerwistGlobalConfig,
} from "serwist";
import { ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";

/** Same shape as operator `failure()` so Eden clients can parse offline errors without Serwist throwing. */
const API_OFFLINE_JSON = JSON.stringify({
	data: null,
	message: "Network unavailable.",
	success: false,
});

const apiMatcher: RouteMatchCallback = ({ sameOrigin, url: { pathname } }) =>
	sameOrigin && pathname.startsWith("/api/");

const apiNetworkOrOfflineFallback: RouteHandler = async ({ request }) => {
	try {
		return await fetch(request);
	} catch {
		return new Response(API_OFFLINE_JSON, {
			headers: { "Content-Type": "application/json" },
			status: 503,
			statusText: "Service Unavailable",
		});
	}
};

const API_HTTP_METHODS = [
	"GET",
	"HEAD",
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
	"OPTIONS",
] as const;

declare global {
	interface WorkerGlobalScope extends SerwistGlobalConfig {
		__SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
	}
}

declare const self: ServiceWorkerGlobalScope;

const manifest = self.__SW_MANIFEST ?? [];

const serwist = new Serwist({
	precacheEntries: [...manifest, "/operator"],
	skipWaiting: true,
	clientsClaim: true,
	navigationPreload: true,
	runtimeCaching: [
		{
			matcher: ({ url: { pathname }, sameOrigin, request }) =>
				sameOrigin && pathname === "/" && request.destination === "document",
			handler: new NetworkOnly(),
		},
		...API_HTTP_METHODS.map((method) => ({
			handler: apiNetworkOrOfflineFallback,
			matcher: apiMatcher,
			method,
		})),
		{
			matcher: ({ sameOrigin, url: { pathname }, request }) =>
				sameOrigin &&
				(pathname === "/operator" || pathname.startsWith("/operator/")) &&
				request.destination === "document",
			handler: new NetworkFirst({
				cacheName: "operator-documents",
				networkTimeoutSeconds: 10,
				plugins: [
					new ExpirationPlugin({
						maxAgeFrom: "last-used",
						maxAgeSeconds: 7 * 24 * 60 * 60,
						maxEntries: 4,
					}),
				],
			}),
		},
		...defaultCache,
	],
	fallbacks: {
		entries: [
			{
				url: "/~offline",
				matcher({ request }) {
					if (request.destination !== "document") return false;
					const pathname = new URL(request.url).pathname;
					if (pathname === "/operator" || pathname.startsWith("/operator/")) {
						return false;
					}
					return true;
				},
			},
		],
	},
});

serwist.addEventListeners();
