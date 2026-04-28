import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { admin, openAPI } from "better-auth/plugins";
import connectToDatabase from "../mongodb";

const client = await connectToDatabase();
const db = client?.connection.db;

const productionTrustedOrigins = (
	process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? []
)
	.map((origin) => origin.trim())
	.filter(Boolean);

export const auth = betterAuth({
	// Base URL for the app
	baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
	database: mongodbAdapter(db!),
	emailAndPassword: {
		autoSignIn: true,
		enabled: true,
		requireEmailVerification: false,
	},
	plugins: [
		admin(),
		openAPI({
			disableDefaultReference: process.env.NODE_ENV === "production",
		}),
	],
	trustedOrigins:
		process.env.NODE_ENV === "production"
			? productionTrustedOrigins.length > 0
				? productionTrustedOrigins
				: [process.env.BETTER_AUTH_URL || "http://localhost:3000"]
			: ["*"],
});

export type Session = typeof auth.$Infer.Session;
