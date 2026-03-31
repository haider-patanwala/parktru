import { Elysia, t } from "elysia";
import { operatorOperationsController } from "@/features/operator-operations/controllers/operator-operations.controller";
import { auth } from "@/server/better-auth/config";

export const api = new Elysia({ prefix: "/api" })
	.mount(auth.handler)
	.use(operatorOperationsController)
	.get("/health", () => ({
		data: {
			status: "healthy",
			timestamp: new Date().toISOString(),
		},
		success: true,
	}))
	.post("/", ({ body }) => body, {
		body: t.Object({
			name: t.String(),
		}),
	});

export type Api = typeof api;
