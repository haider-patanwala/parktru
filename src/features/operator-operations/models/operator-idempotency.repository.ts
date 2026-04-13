import { OperatorIdempotencyModel } from "@/features/operator-operations/models/operator-idempotency.schema";
import connectToDatabase from "@/server/mongodb";

async function ensureConnected() {
	await connectToDatabase();
}

export async function getIdempotentResponse(input: {
	key: string;
	userId: string;
}): Promise<unknown | null> {
	await ensureConnected();
	const row = await OperatorIdempotencyModel.findOne({
		key: input.key,
		userId: input.userId,
	})
		.lean()
		.exec();
	return row?.response ?? null;
}

export async function saveIdempotentResponse(input: {
	key: string;
	response: unknown;
	route: string;
	userId: string;
}): Promise<void> {
	await ensureConnected();
	await OperatorIdempotencyModel.findOneAndUpdate(
		{ key: input.key, userId: input.userId },
		{
			$set: {
				key: input.key,
				response: input.response,
				route: input.route,
				userId: input.userId,
			},
		},
		{ upsert: true },
	).exec();
}
