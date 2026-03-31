import { treaty } from "@elysiajs/eden";
import type { Api } from "@/server";

// .api to enter /api prefix
export const eden = treaty<Api>(
	typeof window !== "undefined"
		? window.location.origin
		: "http://localhost:3000",
).api;
