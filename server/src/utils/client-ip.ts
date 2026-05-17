import type { Context } from "hono";
import { isIP } from "node:net";

/**
 * Resolve the originating client IP for a Hono request.
 *
 * Order of precedence:
 *   1. Underlying socket remoteAddress from the Node adapter (trusted source).
 *   2. X-Real-IP — proxy-provided fallback.
 *   3. X-Forwarded-For (left-most hop) — originating client in append-style proxy setups.
 *   4. CF-Connecting-IP — Cloudflare, if it ever lands in front.
 *
 * Returns null if nothing usable is found.
 */
export function getClientIp(c: Context): string | null {
  const env = (c as Context & {
    env?: { incoming?: { socket?: { remoteAddress?: string | null } } };
  }).env;
  const remoteAddress = parseIp(env?.incoming?.socket?.remoteAddress);
  if (remoteAddress) return remoteAddress;

  const realIp = c.req.header("x-real-ip");
  const parsedRealIp = parseIp(realIp);
  if (parsedRealIp) {
    return parsedRealIp;
  }

  const forwardedFor = c.req.header("x-forwarded-for");
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    const hops = forwardedFor
      .split(",")
      .map((hop) => parseIp(hop))
      .filter((hop): hop is string => Boolean(hop));
    const leftMost = hops.at(0);
    if (leftMost) {
      return leftMost;
    }
  }

  const cfConnectingIp = c.req.header("cf-connecting-ip");
  const parsedCfIp = parseIp(cfConnectingIp);
  if (parsedCfIp) {
    return parsedCfIp;
  }

  return null;
}

function parseIp(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const bracketMatch = trimmed.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketMatch) {
    const ip = bracketMatch[1];
    return isIP(ip) ? ip : null;
  }

  if (isIP(trimmed)) {
    return trimmed;
  }

  const ipv4WithPort = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) {
    const ip = ipv4WithPort[1];
    return isIP(ip) ? ip : null;
  }

  return null;
}
