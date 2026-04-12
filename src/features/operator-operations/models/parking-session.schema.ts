import { type Model, model, models, Schema, type Types } from "mongoose";

export interface ParkingSessionDocument {
	baseRateSnapshot: number;
	closedBy: string | null;
	createdAt: Date;
	createdBy: string;
	customerName: string;
	customerPhone: string;
	displayPlateNumber: string;
	entryAt: Date;
	exitAt: Date | null;
	finalAmount: number | null;
	normalizedPlateNumber: string;
	overrideAmount: number | null;
	parkingGateId: Types.ObjectId | null;
	parkingLotId: Types.ObjectId;
	receiptId: Types.ObjectId | null;
	status: "active" | "closed";
	tenantId: Types.ObjectId;
	updatedAt: Date;
	updatedBy: string;
	vehicleType: string;
}

const parkingSessionSchema = new Schema(
	{
		baseRateSnapshot: {
			min: 0,
			required: true,
			type: Number,
		},
		closedBy: {
			default: null,
			type: String,
		},
		createdBy: {
			required: true,
			type: String,
		},
		customerName: {
			default: "",
			trim: true,
			type: String,
		},
		customerPhone: {
			required: true,
			trim: true,
			type: String,
		},
		displayPlateNumber: {
			required: true,
			trim: true,
			type: String,
		},
		entryAt: {
			required: true,
			type: Date,
		},
		exitAt: {
			default: null,
			type: Date,
		},
		finalAmount: {
			default: null,
			min: 0,
			type: Number,
		},
		normalizedPlateNumber: {
			index: true,
			required: true,
			type: String,
		},
		overrideAmount: {
			default: null,
			min: 0,
			type: Number,
		},
		parkingGateId: {
			default: null,
			ref: "ParkingGate",
			type: Schema.Types.ObjectId,
		},
		parkingLotId: {
			index: true,
			ref: "ParkingLot",
			required: true,
			type: Schema.Types.ObjectId,
		},
		receiptId: {
			default: null,
			ref: "Receipt",
			type: Schema.Types.ObjectId,
		},
		status: {
			default: "active",
			enum: ["active", "closed"],
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
		vehicleType: {
			default: "",
			trim: true,
			type: String,
		},
	},
	{
		timestamps: true,
	},
);

parkingSessionSchema.index({
	normalizedPlateNumber: 1,
	status: 1,
	tenantId: 1,
});
parkingSessionSchema.index({ parkingLotId: 1, status: 1, tenantId: 1 });

export const ParkingSessionModel =
	(models.ParkingSession as Model<ParkingSessionDocument> | undefined) ||
	model<ParkingSessionDocument>("ParkingSession", parkingSessionSchema);
