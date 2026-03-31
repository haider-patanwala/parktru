declare global {
	namespace NodeJS {
		interface ProcessEnv {
			BETTER_AUTH_URL: string;
			MONGODB_URI: string;
			REDIS_URL: string;
			NODE_ENV: "development" | "production";
		}
	}
}
