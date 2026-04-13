import { type Model, model, models, Schema } from "mongoose";

export interface OperatorIdempotencyDocument {
	createdAt: Date;
	key: string;
	response: unknown;
	route: string;
	userId: string;
}

const operatorIdempotencySchema = new Schema(
	{
		key: { required: true, type: String },
		response: { required: true, type: Schema.Types.Mixed },
		route: { required: true, type: String },
		userId: { required: true, type: String },
	},
	{
		timestamps: { createdAt: true, updatedAt: false },
	},
);

operatorIdempotencySchema.index(
	{ userId: 1, key: 1 },
	{ unique: true },
);
operatorIdempotencySchema.index(
	{ createdAt: 1 },
	{ expireAfterSeconds: 60 * 60 * 24 * 14 },
);

export const OperatorIdempotencyModel =
	(models.OperatorIdempotency as Model<OperatorIdempotencyDocument> | undefined) ||
	model<OperatorIdempotencyDocument>(
		"OperatorIdempotency",
		operatorIdempotencySchema,
	);
