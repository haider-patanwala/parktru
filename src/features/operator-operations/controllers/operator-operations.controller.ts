import { Elysia, t } from "elysia";
import {
	bootstrapOperatorWorkspace,
	closeParkingExit,
	createParkingEntry,
	generateReceiptLink,
	getOperatorContextForUser,
	getSessionsForLot,
	lookupPlateForTenant,
	setParkingLotBaseRate,
	setSelectedParkingLotForUser,
	updateParkingEntryTime,
} from "@/features/operator-operations/models/operator-operations.repository";
import type { ApiResult } from "@/features/operator-operations/models/operator-operations.types";
import { auth } from "@/server/better-auth/config";

function failure(message: string): ApiResult<never> {
	return {
		data: null,
		message,
		success: false,
	};
}

function success<T>(data: T): ApiResult<T> {
	return {
		data,
		success: true,
	};
}

async function getAuthenticatedUser(request: Request) {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	return session?.user ?? null;
}

export const operatorOperationsController = new Elysia({
	prefix: "/operator",
})
	.get("/context", async ({ request, set }) => {
		const user = await getAuthenticatedUser(request);

		if (!user) {
			set.status = 401;
			return failure("Sign in to access operator workflows.");
		}

		return success(
			await getOperatorContextForUser({
				email: user.email,
				id: user.id,
				name: user.name,
				role: "role" in user ? user.role : null,
			}),
		);
	})
	.post(
		"/bootstrap",
		async ({ body, request, set }) => {
			const user = await getAuthenticatedUser(request);

			if (!user) {
				set.status = 401;
				return failure("Sign in before creating an operator workspace.");
			}

			return success(
				await bootstrapOperatorWorkspace({
					baseRate: body.baseRate,
					initialLotName: body.initialLotName,
					tenantName: body.tenantName,
					user: {
						email: user.email,
						id: user.id,
						name: user.name,
						role: "role" in user ? user.role : null,
					},
				}),
			);
		},
		{
			body: t.Object({
				baseRate: t.Numeric({ minimum: 0 }),
				initialLotName: t.String({ minLength: 2 }),
				tenantName: t.String({ minLength: 2 }),
			}),
		},
	)
	.post(
		"/select-lot",
		async ({ body, request, set }) => {
			const user = await getAuthenticatedUser(request);

			if (!user) {
				set.status = 401;
				return failure("Sign in before switching lots.");
			}

			const updated = await setSelectedParkingLotForUser({
				parkingLotId: body.parkingLotId,
				userId: user.id,
			});

			if (!updated) {
				set.status = 403;
				return failure("That lot is not available for this operator.");
			}

			return success(
				await getOperatorContextForUser({
					email: user.email,
					id: user.id,
					name: user.name,
					role: "role" in user ? user.role : null,
				}),
			);
		},
		{
			body: t.Object({
				parkingLotId: t.String(),
			}),
		},
	)
	.get(
		"/sessions",
		async ({ query, request, set }) => {
			const user = await getAuthenticatedUser(request);

			if (!user) {
				set.status = 401;
				return failure("Sign in to load parking sessions.");
			}

			const context = await getOperatorContextForUser({
				email: user.email,
				id: user.id,
				name: user.name,
				role: "role" in user ? user.role : null,
			});
			const parkingLotId = query.parkingLotId ?? context.selectedParkingLotId;

			if (!context.tenant || !parkingLotId) {
				return success({
					activeSessions: [],
					recentSessions: [],
				});
			}

			const allowed = context.allowedLots.some(
				(lot) => lot.id === parkingLotId,
			);

			if (!allowed) {
				set.status = 403;
				return failure("That lot is not available for this operator.");
			}

			return success(
				await getSessionsForLot({
					parkingLotId,
					tenantId: context.tenant.id,
				}),
			);
		},
		{
			query: t.Object({
				parkingLotId: t.Optional(t.String()),
			}),
		},
	)
	.post(
		"/lookup/plate",
		async ({ body, request, set }) => {
			const user = await getAuthenticatedUser(request);

			if (!user) {
				set.status = 401;
				return failure("Sign in to look up vehicle plates.");
			}

			const context = await getOperatorContextForUser({
				email: user.email,
				id: user.id,
				name: user.name,
				role: "role" in user ? user.role : null,
			});

			if (!context.tenant) {
				set.status = 409;
				return failure(
					"Create an operator workspace before using plate lookup.",
				);
			}

			return success(
				await lookupPlateForTenant({
					plateNumber: body.plateNumber,
					tenantId: context.tenant.id,
				}),
			);
		},
		{
			body: t.Object({
				plateNumber: t.String({ minLength: 1 }),
			}),
		},
	)
	.post(
		"/entry",
		async ({ body, request, set }) => {
			const user = await getAuthenticatedUser(request);

			if (!user) {
				set.status = 401;
				return failure("Sign in before creating an entry.");
			}

			const context = await getOperatorContextForUser({
				email: user.email,
				id: user.id,
				name: user.name,
				role: "role" in user ? user.role : null,
			});

			if (!context.tenant) {
				set.status = 409;
				return failure("Create an operator workspace before creating entries.");
			}

			const allowed = context.allowedLots.some(
				(lot) => lot.id === body.parkingLotId,
			);

			if (!allowed) {
				set.status = 403;
				return failure("That lot is not available for this operator.");
			}

			return success(
				await createParkingEntry({
					customerName: body.customerName,
					customerPhone: body.customerPhone,
					displayPlateNumber: body.displayPlateNumber,
					parkingLotId: body.parkingLotId,
					tenantId: context.tenant.id,
					userId: user.id,
					vehicleType: body.vehicleType,
				}),
			);
		},
		{
			body: t.Object({
				customerName: t.String({ default: "" }),
				customerPhone: t.String({ minLength: 5 }),
				displayPlateNumber: t.String({ minLength: 1 }),
				parkingLotId: t.String(),
				vehicleType: t.Optional(t.String()),
			}),
		},
	)
	.post(
		"/entry-time",
		async ({ body, request, set }) => {
			const user = await getAuthenticatedUser(request);

			if (!user) {
				set.status = 401;
				return failure("Sign in before editing entry time.");
			}

			const context = await getOperatorContextForUser({
				email: user.email,
				id: user.id,
				name: user.name,
				role: "role" in user ? user.role : null,
			});

			if (!context.tenant) {
				set.status = 409;
				return failure("Create an operator workspace before editing sessions.");
			}

			const updated = await updateParkingEntryTime({
				entryAt: body.entryAt,
				parkingSessionId: body.parkingSessionId,
				tenantId: context.tenant.id,
				userId: user.id,
			});

			if (!updated) {
				set.status = 404;
				return failure("The active parking session could not be found.");
			}

			return success(true);
		},
		{
			body: t.Object({
				entryAt: t.String(),
				parkingSessionId: t.String(),
			}),
		},
	)
	.post(
		"/lot-rate",
		async ({ body, request, set }) => {
			const user = await getAuthenticatedUser(request);

			if (!user) {
				set.status = 401;
				return failure("Sign in before updating lot rates.");
			}

			const context = await getOperatorContextForUser({
				email: user.email,
				id: user.id,
				name: user.name,
				role: "role" in user ? user.role : null,
			});

			if (!context.tenant) {
				set.status = 409;
				return failure(
					"Create an operator workspace before updating lot rates.",
				);
			}

			const allowed = context.allowedLots.some(
				(lot) => lot.id === body.parkingLotId,
			);

			if (!allowed) {
				set.status = 403;
				return failure("That lot is not available for this operator.");
			}

			await setParkingLotBaseRate({
				baseRate: body.baseRate,
				parkingLotId: body.parkingLotId,
				tenantId: context.tenant.id,
				userId: user.id,
			});

			return success(true);
		},
		{
			body: t.Object({
				baseRate: t.Numeric({ minimum: 0 }),
				parkingLotId: t.String(),
			}),
		},
	)
	.post(
		"/exit",
		async ({ body, request, set }) => {
			const user = await getAuthenticatedUser(request);

			if (!user) {
				set.status = 401;
				return failure("Sign in before closing exits.");
			}

			const context = await getOperatorContextForUser({
				email: user.email,
				id: user.id,
				name: user.name,
				role: "role" in user ? user.role : null,
			});

			if (!context.tenant) {
				set.status = 409;
				return failure("Create an operator workspace before closing exits.");
			}

			const closed = await closeParkingExit({
				finalAmount: body.finalAmount,
				overrideAmount: body.overrideAmount ?? null,
				parkingSessionId: body.parkingSessionId,
				tenantId: context.tenant.id,
				user: {
					email: user.email,
					id: user.id,
					name: user.name,
					role: "role" in user ? user.role : null,
				},
			});

			if (!closed) {
				set.status = 404;
				return failure("The active parking session could not be found.");
			}

			return success(closed);
		},
		{
			body: t.Object({
				finalAmount: t.Numeric({ minimum: 0 }),
				overrideAmount: t.Optional(t.Numeric({ minimum: 0 })),
				parkingSessionId: t.String(),
			}),
		},
	)
	.post(
		"/receipt/link",
		async ({ body, request, set }) => {
			const user = await getAuthenticatedUser(request);

			if (!user) {
				set.status = 401;
				return failure("Sign in before sharing receipts.");
			}

			const context = await getOperatorContextForUser({
				email: user.email,
				id: user.id,
				name: user.name,
				role: "role" in user ? user.role : null,
			});

			if (!context.tenant) {
				set.status = 409;
				return failure("Create an operator workspace before sharing receipts.");
			}

			const preview = await generateReceiptLink({
				operatorName: user.name ?? user.email ?? "Operator",
				parkingSessionId: body.parkingSessionId,
				tenantId: context.tenant.id,
				userId: user.id,
			});

			if (!preview) {
				set.status = 404;
				return failure(
					"The closed parking session could not be found for receipt sharing.",
				);
			}

			return success(preview);
		},
		{
			body: t.Object({
				parkingSessionId: t.String(),
			}),
		},
	);
