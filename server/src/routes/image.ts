import { type IncomingMessage, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { json } from "../utils/http";

function isAllowedImageHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "liquipedia.net" ||
    normalized.endsWith(".liquipedia.net") ||
    normalized === "liquipedia.org" ||
    normalized.endsWith(".liquipedia.org")
  );
}

export async function handleImage(_req: IncomingMessage, res: ServerResponse, url: URL) {
  const target = url.searchParams.get("url");
  if (!target) {
    json(res, 400, { error: "Missing url" });
    return;
  }
  try {
    const targetUrl = new URL(target);
    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      json(res, 400, { error: "Invalid protocol" });
      return;
    }
    if (!isAllowedImageHost(targetUrl.hostname)) {
      json(res, 403, { error: "Host not allowed" });
      return;
    }
    const response = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent": "RLCS-Stats/1.0",
        Referer: "https://liquipedia.net/",
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8"
      },
      redirect: "follow"
    });
    if (!response.ok || !response.body) {
      json(res, 502, { error: "Failed to fetch image" });
      return;
    }
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"
    });
    Readable.fromWeb(
      response.body as unknown as import("node:stream/web").ReadableStream
    ).pipe(res);
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Image proxy failed" });
  }
}
