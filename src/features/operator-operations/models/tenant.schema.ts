import { type Model, model, models, Schema } from "mongoose";

export interface TenantWorkspaceDocument {
	createdAt: Date;
	name: string;
	ownerUserId: string;
	updatedAt: Date;
}

const tenantWorkspaceSchema = new Schema(
	{
		name: {
			required: true,
			trim: true,
			type: String,
		},
		ownerUserId: {
			index: true,
			required: true,
			type: String,
		},
	},
	{
		timestamps: true,
	},
);

export const TenantWorkspaceModel =
	(models.TenantWorkspace as Model<TenantWorkspaceDocument> | undefined) ||
	model<TenantWorkspaceDocument>("TenantWorkspace", tenantWorkspaceSchema);
