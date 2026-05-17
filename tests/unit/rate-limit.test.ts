import { Hono } from "hono";
import { describe, expect, test } from "bun:test";
import { createRateLimiter } from "../../server/src/middleware/rate-limit";

function buildApp(capacity: number, windowMs: number, clock: { now: number }) {
  const limiter = createRateLimiter({
    capacity,
    windowMs,
    now: () => clock.now,
    keyFn: () => "test-key"
  });
  const app = new Hono();
  app.use("/limited", limiter.middleware);
  app.get("/limited", (c) => c.json({ ok: true }));
  return { app, limiter };
}

async function hit(app: Hono): Promise<Response> {
  return app.request("/limited");
}

describe("rate-limit middleware", () => {
  test("allows up to capacity, then 429s with Retry-After", async () => {
    const clock = { now: 1_000_000 };
    const { app } = buildApp(3, 60_000, clock);

    for (let i = 0; i < 3; i++) {
      const res = await hit(app);
      expect(res.status).toBe(200);
    }

    const blocked = await hit(app);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "Rate limit exceeded" });
    const retryAfter = Number(blocked.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    // 1 token at 3 per 60s → ~20s to refill one token.
    expect(retryAfter).toBeLessThanOrEqual(20);
  });

  test("refills over time and allows again after the window", async () => {
    const clock = { now: 1_000_000 };
    const { app } = buildApp(2, 60_000, clock);

    expect((await hit(app)).status).toBe(200);
    expect((await hit(app)).status).toBe(200);
    expect((await hit(app)).status).toBe(429);

    // Advance past the full window — bucket should be back at full.
    clock.now += 60_000;

    expect((await hit(app)).status).toBe(200);
    expect((await hit(app)).status).toBe(200);
    expect((await hit(app)).status).toBe(429);
  });

  test("partial refill grants exactly the recovered tokens", async () => {
    const clock = { now: 1_000_000 };
    const { app } = buildApp(4, 60_000, clock);

    for (let i = 0; i < 4; i++) {
      expect((await hit(app)).status).toBe(200);
    }
    expect((await hit(app)).status).toBe(429);

    // Half the window → 2 tokens recovered.
    clock.now += 30_000;
    expect((await hit(app)).status).toBe(200);
    expect((await hit(app)).status).toBe(200);
    expect((await hit(app)).status).toBe(429);
  });

  test("sweep evicts buckets idle past the TTL", async () => {
    const clock = { now: 1_000_000 };
    const { app, limiter } = buildApp(1, 60_000, clock);

    await hit(app);
    expect(limiter._buckets.size).toBe(1);

    // Idle TTL is 1h — advance past it then trigger a sweep.
    clock.now += 60 * 60 * 1000 + 1;
    limiter._sweep(clock.now);
    expect(limiter._buckets.size).toBe(0);
  });
});
