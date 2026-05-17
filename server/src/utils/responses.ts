import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const DEFAULT_READ_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";

export function jsonCached(
  c: Context,
  payload: unknown,
  status: ContentfulStatusCode = 200,
  cacheControl: string = DEFAULT_READ_CACHE_CONTROL
) {
  c.header("Cache-Control", cacheControl);
  return c.json(payload as Record<string, unknown>, status);
}

export function errorJson(c: Context, status: ContentfulStatusCode, message: string) {
  return c.json({ error: message }, status);
}
