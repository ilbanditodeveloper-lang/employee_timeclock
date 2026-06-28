import { RATE_LIMIT_MSG } from "@shared/const";

type Bucket = { count: number; resetAt: number };

/**
 * In-memory rate limit store.
 * For production with multiple instances, replace with Redis/Upstash
 * via setRateLimitStore() — see docs in .env.example.
 */
export type RateLimitStore = {
  check(key: string, maxAttempts?: number, windowMs?: number): void;
};

class InMemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, Bucket>();

  check(key: string, maxAttempts = 8, windowMs = 60_000): void {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    bucket.count += 1;
    if (bucket.count > maxAttempts) {
      throw new Error(RATE_LIMIT_MSG);
    }
  }
}

let store: RateLimitStore = new InMemoryRateLimitStore();

/** Swap the backing store (e.g. Redis/Upstash) without changing call sites. */
export function setRateLimitStore(next: RateLimitStore): void {
  store = next;
}

export function checkRateLimit(key: string, maxAttempts = 8, windowMs = 60_000): void {
  store.check(key, maxAttempts, windowMs);
}

/** Limits by client IP and by identifier (username/email). */
export function checkRateLimitWithIp(
  scope: string,
  clientIp: string,
  identifier: string,
  maxAttempts = 8,
  windowMs = 60_000
): void {
  checkRateLimit(`${scope}:ip:${clientIp}`, maxAttempts * 2, windowMs);
  checkRateLimit(`${scope}:${identifier.trim().toLowerCase()}`, maxAttempts, windowMs);
}
