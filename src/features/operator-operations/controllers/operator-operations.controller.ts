import { Elysia, t } from "elysia";
import {
	getIdempotentResponse,
	saveIdempotentResponse,
} from "@/features/operator-operations/models/operator-idempotency.repository";
import {
	bootstrapOperatorWorkspace,
	closeParkingExit,
	createParkingEntry,
	createParkingGateForLot,
	createParkingLotForOperator,
	generateReceiptLink,
	getLotReport,
	getOperatorContextForUser,
	getReportSessionsForCar,
	getReportSessionsForOwner,
	getSessionsForLot,
	lookupPlateForTenant,
	setParkingLotBaseRate,
	setSelectedParkingGateForUser,
	setSelectedParkingLotForUser,
	updateParkingEntryRate,
	updateParkingEntryTime,
} from "@/features/operator-operations/models/operator-operations.repository";
import type {
	ApiResult,
	OperatorContext,
} from "@/features/operator-operations/models/operator-operations.types";
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

async function withIdempotency<T>(input: {
	key: string | undefined;
	run: () => Promise<T>;
	route: string;
	shouldCache?: (result: T) => boolean;
	userId: string;
}): Promise<T> {
	const trimmed = input.key?.trim();
	if (!trimmed) {
		return input.run();
	}
	const cached = await getIdempotentResponse({
		key: trimmed,
		userId: input.userId,
	});
	if (cached !== null) {
		return cached as T;
	}
	const result = await input.run();
	const allowCache =
		typeof input.shouldCache === "function"
			? input.shouldCache(result)
			: result !== null && result !== undefined;
	if (allowCache) {
		await saveIdempotentResponse({
			key: trimmed,
			response: result,
			route: input.route,
			userId: input.userId,
		});
	}
	return result;
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
				await withIdempotency({
					key: body.idempotencyKey,
					route: "POST /operator/bootstrap",
					run: () =>
						bootstrapOperatorWorkspace({
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
					userId: user.id,
				}),
			);
		},
		{
			body: t.Object({
				baseRate: t.Numeric({ minimum: 0 }),
				idempotencyKey: t.Optional(t.String()),
				initialLotName: t.String({ minLength: 2 }),
				tenantName: t.String({ minLength: 2 }),
			}),
		},
	)
	.post(
		"/parking-lot",
		async ({ body, request, set }) => {
			const user = await getAuthenticatedUser(request);

			if (!user) {
				set.status = 401;
				return failure("Sign in before adding parking lots.");
			}

			const name = body.name.trim();
			if (name.length < 2) {
				set.status = 400;
				return failure("Lot name must be at least 2 characters.");
			}

			const context = await withIdempotency({
				key: body.idempotencyKey,
				route: "POST /operator/parking-lot",
				run: () =>
					createParkingLotForOperator({
						baseRate: body.baseRate,
						name,
						user: {
							email: user.email,
							id: user.id,
							name: user.name,
							role: "role" in user ? user.role : null,
						},
					}),
				shouldCache: (ctx) => ctx !== null,
				userId: user.id,
			});

			if (!context) {
				set.status = 409;
				return failure(
					"Create an operator workspace before adding parking lots.",
				);
			}

			return success(context);
		},
		{
			body: t.Object({
				baseRate: t.Optional(t.Numeric({ minimum: 0 })),
				idempotencyKey: t.Optional(t.String()),
				name: t.String({ minLength: 1 }),
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

			const context = await withIdempotency({
				key: body.idempotencyKey,
				route: "POST /operator/select-lot",
				run: async () => {
					const updated = await setSelectedParkingLotForUser({
						parkingLotId: body.parkingLotId,
						userId: user.id,
					});
					if (!updated) {
						return null;
					}
					return getOperatorContextForUser({
						email: user.email,
						id: user.id,
						name: user.name,
						role: "role" in user ? user.role : null,
					});
				},
				shouldCache: (ctx) => ctx !== null,
				userId: user.id,
			});

			if (!context) {
				set.status = 403;
				return failure("That lot is not available for this operator.");
			}

			return success(context);
		},
		{
			body: t.Object({
				idempotencyKey: t.Optional(t.String()),
				parkingLotId: t.String(),
			}),
		},
	)
	.post(
		"/select-gate",
		async ({ body, request, set }) => {
			const user = await getAuthenticatedUser(request);

			if (!user) {
				set.status = 401;
				return failure("Sign in before switching gates.");
			}

			const context = await withIdempotency({
				key: body.idempotencyKey,
				route: "POST /operator/select-gate",
				run: async () => {
					const updated = await setSelectedParkingGateForUser({
						parkingGateId: body.parkingGateId,
						userId: user.id,
					});
					if (!updated) {
						return null;
					}
					return getOperatorContextForUser({
						email: user.email,
						id: user.id,
						name: user.name,
						role: "role" in user ? user.role : null,
					});
				},
				shouldCache: (ctx) => ctx !== null,
				userId: user.id,
			});

			if (!context) {
				set.status = 403;
				return failure("That gate is not available for the current lot.");
			}

			return success(context);
		},
		{
			body: t.Object({
				idempotencyKey: t.Optional(t.String()),
				parkingGateId: t.String(),
			}),
		},
	)
	.post(
		"/parking-gate",
		async ({ body, request, set }) => {
			const user = await getAuthenticatedUser(request);

			if (!user) {
				set.status = 401;
				return failure("Sign in before creating gates.");
			}

			type GateOutcome =
				| { context: OperatorContext; kind: "ok" }
				| { kind: "forbidden_lot" }
				| { kind: "no_tenant" };

			const outcome = await withIdempotency({
				key: body.idempotencyKey,
				route: "POST /operator/parking-gate",
				run: async (): Promise<GateOutcome> => {
					const context = await getOperatorContextForUser({
						email: user.email,
						id: user.id,
						name: user.name,
						role: "role" in user ? user.role : null,
					});

					if (!context.tenant) {
						return { kind: "no_tenant" };
					}

					const allowed = context.allowedLots.some(
						(lot) => lot.id === body.parkingLotId,
					);

					if (!allowed) {
						return { kind: "forbidden_lot" };
					}

					await createParkingGateForLot({
						name: body.name.trim(),
						parkingLotId: body.parkingLotId,
						tenantId: context.tenant.id,
						userId: user.id,
					});

					const next = await getOperatorContextForUser({
						email: user.email,
						id: user.id,
						name: user.name,
						role: "role" in user ? user.role : null,
					});

					return { context: next, kind: "ok" };
				},
				shouldCache: (r) => r.kind === "ok",
				userId: user.id,
			});

			if (outcome.kind === "no_tenant") {
				set.status = 409;
				return failure("Create an operator workspace before adding gates.");
			}

			if (outcome.kind === "forbidden_lot") {
				set.status = 403;
				return failure("That lot is not available for this operator.");
			}

			return success(outcome.context);
		},
		{
			body: t.Object({
				idempotencyKey: t.Optional(t.String()),
				name: t.String({ minLength: 2 }),
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
				return failure("Sign in to see who is parked.");
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
	.get(
		"/reports",
		async ({ query, request, set }) => {
			const user = await getAuthenticatedUser(request);

			if (!user) {
				set.status = 401;
				return failure("Sign in to view reports.");
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
					cars: [],
					closedSessionCount: 0,
					owners: [],
					totalRevenue: 0,
					uniqueCarCount: 0,
					uniqueOwnerCount: 0,
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
				await getLotReport({
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
	.get(
		"/reports/car",
		async ({ query, request, set }) => {
			const user = await getAuthenticatedUser(request);

			if (!user) {
				set.status = 401;
				return failure("Sign in to view vehicle history.");
			}

			const context = await getOperatorContextForUser({
				email: user.email,
				id: user.id,
				name: user.name,
				role: "role" in user ? user.role : null,
			});

			if (!context.tenant) {
				return success([]);
			}

			const allowed = context.allowedLots.some(
				(lot) => lot.id === query.parkingLotId,
			);

			if (!allowed) {
				set.status = 403;
				return failure("That lot is not available for this operator.");
			}

			return success(
				await getReportSessionsForCar({
					normalizedPlateNumber: query.normalizedPlateNumber,
					parkingLotId: query.parkingLotId,
					tenantId: context.tenant.id,
				}),
			);
		},
		{
			query: t.Object({
				normalizedPlateNumber: t.String({ minLength: 1 }),
				parkingLotId: t.String(),
			}),
		},
	)
	.get(
		"/reports/owner",
		async ({ query, request, set }) => {
			const user = await getAuthenticatedUser(request);

			if (!user) {
				set.status = 401;
				return failure("Sign in to view customer history.");
			}

			const context = await getOperatorContextForUser({
				email: user.email,
				id: user.id,
				name: user.name,
				role: "role" in user ? user.role : null,
			});

			if (!context.tenant) {
				return success([]);
			}

			const allowed = context.allowedLots.some(
				(lot) => lot.id === query.parkingLotId,
			);

			if (!allowed) {
				set.status = 403;
				return failure("That lot is not available for this operator.");
			}

			return success(
				await getReportSessionsForOwner({
					customerPhone: query.customerPhone,
					parkingLotId: query.parkingLotId,
					tenantId: context.tenant.id,
				}),
			);
		},
		{
			query: t.Object({
				customerPhone: t.String({ minLength: 3 }),
				parkingLotId: t.String(),
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

			const tenantId = context.tenant.id;

			const allowed = context.allowedLots.some(
				(lot) => lot.id === body.parkingLotId,
			);

			if (!allowed) {
				set.status = 403;
				return failure("That lot is not available for this operator.");
			}

			const entryResult = await withIdempotency({
				key: body.idempotencyKey,
				route: "POST /operator/entry",
				run: () =>
					createParkingEntry({
						clientMutationId: body.clientMutationId,
						customerName: body.customerName,
						customerPhone: body.customerPhone,
						displayPlateNumber: body.displayPlateNumber,
						entryAt: body.entryAt,
						nationalityCode: body.nationalityCode,
						parkingGateId: body.parkingGateId,
						parkingLotId: body.parkingLotId,
						rateAmount: body.rateAmount,
						rateMode: body.rateMode,
						tenantId,
						userId: user.id,
						vehicleType: body.vehicleType,
					}),
				userId: user.id,
			});

			if ("invalidGate" in entryResult && entryResult.invalidGate) {
				set.status = 400;
				return failure("Pick a valid gate for this parking lot.");
			}

			return success(entryResult);
		},
		{
			body: t.Object({
				clientMutationId: t.Optional(t.String()),
				customerName: t.String({ default: "" }),
				/** Match operator UI + offline outbox (short codes, empty walk-ins). */
				customerPhone: t.String({ default: "" }),
				displayPlateNumber: t.String({ minLength: 1 }),
				entryAt: t.Optional(t.String()),
				idempotencyKey: t.Optional(t.String()),
				/** ISO 3166-1 alpha-2 */
				nationalityCode: t.Optional(t.String()),
				parkingGateId: t.Optional(t.String()),
				parkingLotId: t.String(),
				rateAmount: t.Optional(t.Numeric({ minimum: 0 })),
				rateMode: t.Optional(
					t.Union([t.Literal("hourly"), t.Literal("session")]),
				),
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
				return failure(
					"Create an operator workspace before editing parking records.",
				);
			}

			const tenantId = context.tenant.id;

			const updated = await withIdempotency({
				key: body.idempotencyKey,
				route: "POST /operator/entry-time",
				run: () =>
					updateParkingEntryTime({
						entryAt: body.entryAt,
						parkingSessionId: body.parkingSessionId,
						tenantId,
						userId: user.id,
					}),
				shouldCache: (doc) => doc !== null,
				userId: user.id,
			});

			if (!updated) {
				set.status = 404;
				return failure("No matching parked vehicle was found.");
			}

			return success(true);
		},
		{
			body: t.Object({
				entryAt: t.String(),
				idempotencyKey: t.Optional(t.String()),
				parkingSessionId: t.String(),
			}),
		},
	)
	.post(
		"/entry-rate",
		async ({ body, request, set }) => {
			const user = await getAuthenticatedUser(request);

			if (!user) {
				set.status = 401;
				return failure("Sign in before editing parking amount.");
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
					"Create an operator workspace before editing parking records.",
				);
			}

			const tenantId = context.tenant.id;

			const updated = await withIdempotency({
				key: body.idempotencyKey,
				route: "POST /operator/entry-rate",
				run: () =>
					updateParkingEntryRate({
						amount: body.amount,
						parkingSessionId: body.parkingSessionId,
						tenantId,
						userId: user.id,
					}),
				shouldCache: (doc) => doc !== null,
				userId: user.id,
			});

			if (!updated) {
				set.status = 404;
				return failure("No matching parked vehicle was found.");
			}

			return success(true);
		},
		{
			body: t.Object({
				amount: t.Numeric({ minimum: 0 }),
				idempotencyKey: t.Optional(t.String()),
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

			const tenantId = context.tenant.id;

			const allowed = context.allowedLots.some(
				(lot) => lot.id === body.parkingLotId,
			);

			if (!allowed) {
				set.status = 403;
				return failure("That lot is not available for this operator.");
			}

			const currencyRaw = body.currencyCode?.trim().toUpperCase();
			const countryRaw = body.countryCode?.trim().toUpperCase();

			if (currencyRaw && !/^[A-Z]{3}$/.test(currencyRaw)) {
				set.status = 400;
				return failure(
					"Currency must be a valid ISO 4217 code (e.g. USD, INR).",
				);
			}

			if (countryRaw && !/^[A-Z]{2}$/.test(countryRaw)) {
				set.status = 400;
				return failure("Country must be a valid ISO 3166-1 alpha-2 code.");
			}

			await withIdempotency({
				key: body.idempotencyKey,
				route: "POST /operator/lot-rate",
				run: () =>
					setParkingLotBaseRate({
						baseRate: body.baseRate,
						countryCode: countryRaw || undefined,
						currencyCode: currencyRaw || undefined,
						parkingLotId: body.parkingLotId,
						tenantId,
						userId: user.id,
					}),
				userId: user.id,
			});

			return success(true);
		},
		{
			body: t.Object({
				baseRate: t.Numeric({ minimum: 0 }),
				countryCode: t.Optional(t.String()),
				currencyCode: t.Optional(t.String()),
				idempotencyKey: t.Optional(t.String()),
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

			const tenantId = context.tenant.id;

			const closed = await withIdempotency({
				key: body.idempotencyKey,
				route: "POST /operator/exit",
				run: () =>
					closeParkingExit({
						finalAmount: body.finalAmount,
						overrideAmount: body.overrideAmount ?? null,
						parkingSessionId: body.parkingSessionId,
						tenantId,
						user: {
							email: user.email,
							id: user.id,
							name: user.name,
							role: "role" in user ? user.role : null,
						},
					}),
				shouldCache: (c) => c !== null,
				userId: user.id,
			});

			if (!closed) {
				set.status = 404;
				return failure("No matching parked vehicle was found.");
			}

			return success(closed);
		},
		{
			body: t.Object({
				finalAmount: t.Numeric({ minimum: 0 }),
				idempotencyKey: t.Optional(t.String()),
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

			const tenantId = context.tenant.id;

			const preview = await withIdempotency({
				key: body.idempotencyKey,
				route: "POST /operator/receipt/link",
				run: () =>
					generateReceiptLink({
						operatorName: user.name ?? user.email ?? "Operator",
						parkingSessionId: body.parkingSessionId,
						tenantId,
						userId: user.id,
					}),
				shouldCache: (p) => p !== null,
				userId: user.id,
			});

			if (!preview) {
				set.status = 404;
				return failure(
					"That completed exit could not be found for receipt sharing.",
				);
			}

			return success(preview);
		},
		{
			body: t.Object({
				idempotencyKey: t.Optional(t.String()),
				parkingSessionId: t.String(),
			}),
		},
	);
