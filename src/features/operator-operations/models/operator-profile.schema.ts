import { type Model, model, models, Schema, type Types } from "mongoose";

export interface OperatorProfileDocument {
	allowedParkingLotIds: Types.ObjectId[];
	createdAt: Date;
	role: string;
	selectedParkingGateId: Types.ObjectId | null;
	selectedParkingLotId: Types.ObjectId | null;
	tenantId: Types.ObjectId;
	updatedAt: Date;
	userId: string;
}

const operatorProfileSchema = new Schema(
	{
		allowedParkingLotIds: {
			default: [],
			type: [Schema.Types.ObjectId],
		},
		role: {
			default: "lot-operator",
			required: true,
			type: String,
		},
		selectedParkingGateId: {
			default: null,
			ref: "ParkingGate",
			type: Schema.Types.ObjectId,
		},
		selectedParkingLotId: {
			default: null,
			type: Schema.Types.ObjectId,
		},
		tenantId: {
			index: true,
			ref: "TenantWorkspace",
			required: true,
			type: Schema.Types.ObjectId,
		},
		userId: {
			index: true,
			required: true,
			type: String,
			unique: true,
		},
	},
	{
		timestamps: true,
	},
);

export const OperatorProfileModel =
	(models.OperatorProfile as Model<OperatorProfileDocument> | undefined) ||
	model<OperatorProfileDocument>("OperatorProfile", operatorProfileSchema);
