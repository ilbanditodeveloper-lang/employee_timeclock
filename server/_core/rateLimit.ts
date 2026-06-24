type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Simple in-memory rate limiter for login attempts. */
export function checkRateLimit(key: string, maxAttempts = 8, windowMs = 60_000): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > maxAttempts) {
    throw new Error("Demasiados intentos. Espera un minuto e inténtalo de nuevo.");
  }
}
