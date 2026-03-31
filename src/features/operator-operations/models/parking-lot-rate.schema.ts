import { type Model, model, models, Schema, type Types } from "mongoose";

export interface ParkingLotRateDocument {
	baseRate: number;
	createdAt: Date;
	parkingLotId: Types.ObjectId;
	tenantId: Types.ObjectId;
	updatedAt: Date;
	updatedBy: string;
}

const parkingLotRateSchema = new Schema(
	{
		baseRate: {
			min: 0,
			required: true,
			type: Number,
		},
		parkingLotId: {
			index: true,
			ref: "ParkingLot",
			required: true,
			type: Schema.Types.ObjectId,
		},
		tenantId: {
			index: true,
			ref: "TenantWorkspace",
			required: true,
			type: Schema.Types.ObjectId,
		},
		updatedBy: {
			required: true,
			type: String,
		},
	},
	{
		timestamps: true,
	},
);

parkingLotRateSchema.index({ parkingLotId: 1, tenantId: 1 }, { unique: true });

export const ParkingLotRateModel =
	(models.ParkingLotRate as Model<ParkingLotRateDocument> | undefined) ||
	model<ParkingLotRateDocument>("ParkingLotRate", parkingLotRateSchema);
