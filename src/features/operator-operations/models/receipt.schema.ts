import { type Model, model, models, Schema, type Types } from "mongoose";

export interface ReceiptDocument {
	createdAt: Date;
	createdBy: string;
	generatedAt: Date;
	parkingLotId: Types.ObjectId;
	parkingSessionId: Types.ObjectId;
	receiptNumber: string;
	shareToken: string;
	tenantId: Types.ObjectId;
	updatedAt: Date;
}

const receiptSchema = new Schema(
	{
		createdBy: {
			required: true,
			type: String,
		},
		generatedAt: {
			required: true,
			type: Date,
		},
		parkingLotId: {
			index: true,
			ref: "ParkingLot",
			required: true,
			type: Schema.Types.ObjectId,
		},
		parkingSessionId: {
			index: true,
			ref: "ParkingSession",
			required: true,
			type: Schema.Types.ObjectId,
			unique: true,
		},
		receiptNumber: {
			required: true,
			type: String,
		},
		shareToken: {
			index: true,
			required: true,
			type: String,
		},
		tenantId: {
			index: true,
			ref: "TenantWorkspace",
			required: true,
			type: Schema.Types.ObjectId,
		},
	},
	{
		timestamps: true,
	},
);

export const ReceiptModel =
	(models.Receipt as Model<ReceiptDocument> | undefined) ||
	model<ReceiptDocument>("Receipt", receiptSchema);
