/**
 * Redis client using Bun's native Redis support
 * @see https://bun.com/docs/runtime/redis
 *
 * This module provides a singleton Redis client instance
 * for queue management and caching operations.
 */
import { RedisClient } from "bun";

// Redis client instance (lazy initialized)
let redisClient: RedisClient | null = null;

/**
 * Get or create the Redis client instance
 * Uses REDIS_URL environment variable or defaults to localhost:6379
 */
export function getRedisClient(): RedisClient {
	if (!redisClient) {
		const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
		redisClient = new RedisClient(redisUrl, {
			autoReconnect: true,
			enableAutoPipelining: true,
			enableOfflineQueue: true,
			maxRetries: 10,
		});
	}
	return redisClient;
}

/**
 * Create a new Redis client instance for pub/sub or isolated operations
 */
export function createRedisClient(): RedisClient {
	const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
	return new RedisClient(redisUrl, {
		autoReconnect: true,
		enableOfflineQueue: true,
		maxRetries: 10,
	});
}

/**
 * Redis key prefixes for different data types
 */
export const RedisKeys = {
	// Active users set (tracks which users have pending jobs)
	activeUsers: () => "queue:active_users",
	// Campaign metadata hash
	campaign: (campaignId: string) => `campaign:${campaignId}`,

	// Campaign events pub/sub channel
	campaignEvents: (campaignId: string) => `campaign:${campaignId}:events`,

	// Job data hash
	job: (jobId: string) => `job:${jobId}`,

	// User job queue (list)
	userQueue: (userId: string) => `queue:user:${userId}`,

	// User rate limit tracking
	userRateLimit: (userId: string) => `ratelimit:user:${userId}`,

	// Worker lock (prevents multiple workers processing same user)
	workerLock: (userId: string) => `worker:lock:${userId}`,
} as const;

/**
 * Campaign status in Redis
 */
export type RedisCampaignStatus =
	| "PENDING"
	| "RUNNING"
	| "COMPLETED"
	| "FAILED"
	| "PARTIAL";

/**
 * Job status in Redis
 */
export type RedisJobStatus = "PENDING" | "SUCCESS" | "FAILED";

/**
 * Campaign metadata structure stored in Redis
 */
export interface RedisCampaignMeta {
	userId: string;
	total: number;
	processed: number;
	success: number;
	failed: number;
	status: RedisCampaignStatus;
	startedAt: string;
}

/**
 * Job data structure stored in Redis
 */
export interface RedisJobData {
	campaignId: string;
	contactId: string;
	phoneNumber: string;
	messageContent: string;
	status: RedisJobStatus;
	response?: string;
	error?: string;
	processedAt?: string;
}

/**
 * Helper to sleep for a given number of milliseconds
 */
export const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate a random delay between min and max milliseconds
 */
export const randomDelay = (minMs: number, maxMs: number): number =>
	Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
