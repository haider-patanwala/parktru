import { type Model, model, models, Schema, type Types } from "mongoose";

export interface ParkingGateDocument {
	code: string;
	createdAt: Date;
	createdBy: string;
	name: string;
	parkingLotId: Types.ObjectId;
	status: "active" | "inactive";
	tenantId: Types.ObjectId;
	updatedAt: Date;
	updatedBy: string;
}

const parkingGateSchema = new Schema(
	{
		code: {
			required: true,
			trim: true,
			type: String,
		},
		createdBy: {
			required: true,
			type: String,
		},
		name: {
			required: true,
			trim: true,
			type: String,
		},
		parkingLotId: {
			index: true,
			ref: "ParkingLot",
			required: true,
			type: Schema.Types.ObjectId,
		},
		status: {
			default: "active",
			enum: ["active", "inactive"],
			type: String,
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

parkingGateSchema.index(
	{ code: 1, parkingLotId: 1, tenantId: 1 },
	{ unique: true },
);

export const ParkingGateModel =
	(models.ParkingGate as Model<ParkingGateDocument> | undefined) ||
	model<ParkingGateDocument>("ParkingGate", parkingGateSchema);
