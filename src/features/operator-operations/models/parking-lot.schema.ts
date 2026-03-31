import { type Model, model, models, Schema, type Types } from "mongoose";

export interface ParkingLotDocument {
	code: string;
	createdAt: Date;
	createdBy: string;
	name: string;
	status: "active" | "inactive";
	tenantId: Types.ObjectId;
	updatedAt: Date;
	updatedBy: string;
}

const parkingLotSchema = new Schema(
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

parkingLotSchema.index({ code: 1, tenantId: 1 }, { unique: true });

export const ParkingLotModel =
	(models.ParkingLot as Model<ParkingLotDocument> | undefined) ||
	model<ParkingLotDocument>("ParkingLot", parkingLotSchema);
