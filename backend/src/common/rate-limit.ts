import { redisConnection } from './queue';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
}

export async function checkRateLimit(
  key: string,
  limitPerSecond: number = 5,
): Promise<RateLimitResult> {
  const windowSec = 1;
  const currentSec = Math.floor(Date.now() / 1000);
  const redisKey = `ratelimit:${key}:${currentSec}`;

  try {
    const current = await redisConnection.incr(redisKey);
    if (current === 1) {
      await redisConnection.expire(redisKey, windowSec + 1);
    }

    if (current > limitPerSecond) {
      return {
        allowed: false,
        limit: limitPerSecond,
        remaining: 0,
        retryAfterSec: 1,
      };
    }

    return {
      allowed: true,
      limit: limitPerSecond,
      remaining: Math.max(0, limitPerSecond - current),
      retryAfterSec: 0,
    };
  } catch (err: any) {
    // Fail-open if Redis error so messaging doesn't break
    console.warn(`[RateLimit] Redis error, failing open:`, err.message);
    return {
      allowed: true,
      limit: limitPerSecond,
      remaining: limitPerSecond,
      retryAfterSec: 0,
    };
  }
}
