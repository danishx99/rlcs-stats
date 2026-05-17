import type { Context, MiddlewareHandler } from "hono";
import { getClientIp } from "../utils/client-ip";

// ---------------------------------------------------------------------------
// Tunable limits — keep these here so they're easy to find and adjust.
// ---------------------------------------------------------------------------

/** POST /api/feedback — writes to DB, so kept tight. */
export const FEEDBACK_SUBMIT_LIMIT = {
  capacity: 5,
  windowMs: 60_000
} as const;

/** PATCH /api/feedback/:id — admin-ish, more lenient. */
export const FEEDBACK_UPDATE_LIMIT = {
  capacity: 30,
  windowMs: 60_000
} as const;

/** Drop buckets idle for this long to keep the map bounded. */
const BUCKET_IDLE_TTL_MS = 60 * 60 * 1000; // 1 hour
/** How often the sweeper runs. */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------

export interface RateLimitOptions {
  /** Max tokens in the bucket (also the burst capacity). */
  capacity: number;
  /** Window over which `capacity` tokens are refilled. */
  windowMs: number;
  /** Optional override for testing — defaults to `Date.now`. */
  now?: () => number;
  /** Stable per-bucket key. Defaults to client IP, or "unknown" if not resolvable. */
  keyFn?: (c: Context) => string;
}

interface Bucket {
  tokens: number;
  /** Last time we refilled this bucket — also doubles as the idle marker. */
  lastRefill: number;
}

export interface RateLimiter {
  middleware: MiddlewareHandler;
  /** Exposed for tests. */
  _buckets: Map<string, Bucket>;
  /** Exposed for tests — run an idle sweep against the given timestamp. */
  _sweep: (now: number) => void;
}

/**
 * Token-bucket rate limiter, in-memory.
 *
 * Each key (default: client IP) gets a bucket holding `capacity` tokens that
 * refill linearly at `capacity / windowMs` tokens per millisecond. Every
 * request consumes one token. Empty bucket → 429 with `Retry-After` (seconds).
 *
 * Memory is bounded by an idle sweeper that drops buckets untouched for
 * `BUCKET_IDLE_TTL_MS`. The sweeper is opportunistic — it runs at most every
 * `SWEEP_INTERVAL_MS` on the request path (no setInterval, so it doesn't keep
 * the event loop alive in tests or shutdown).
 */
export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const { capacity, windowMs } = options;
  const now = options.now ?? Date.now;
  const keyFn = options.keyFn ?? ((c) => getClientIp(c) ?? "unknown");
  const refillPerMs = capacity / windowMs;

  const buckets = new Map<string, Bucket>();
  let lastSweep = now();

  function sweep(currentTime: number) {
    lastSweep = currentTime;
    for (const [key, bucket] of buckets) {
      if (currentTime - bucket.lastRefill > BUCKET_IDLE_TTL_MS) {
        buckets.delete(key);
      }
    }
  }

  const middleware: MiddlewareHandler = async (c, next) => {
    const currentTime = now();

    if (currentTime - lastSweep > SWEEP_INTERVAL_MS) {
      sweep(currentTime);
    }

    const key = keyFn(c);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: capacity, lastRefill: currentTime };
      buckets.set(key, bucket);
    } else {
      const elapsed = currentTime - bucket.lastRefill;
      if (elapsed > 0) {
        bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerMs);
        bucket.lastRefill = currentTime;
      }
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return next();
    }

    // Tokens needed to reach 1 → time until that's true.
    const msUntilToken = Math.ceil((1 - bucket.tokens) / refillPerMs);
    const retryAfter = Math.max(1, Math.ceil(msUntilToken / 1000));
    c.header("Retry-After", String(retryAfter));
    return c.json({ error: "Rate limit exceeded" }, 429);
  };

  return { middleware, _buckets: buckets, _sweep: sweep };
}
