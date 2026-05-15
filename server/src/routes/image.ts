import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { json } from "../utils/http";

const SIZE_BUCKETS = [64, 128, 256, 512, 1024] as const;
const DEFAULT_SIZE = 512;
const WEBP_QUALITY = 80;
const MAX_UPSTREAM_BYTES = 100 * 1024 * 1024; // 100MB safety cap
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const CACHE_DIR = path.resolve(process.env.IMAGE_CACHE_DIR ?? "cache/images");
let cacheDirReady: Promise<void> | null = null;
function ensureCacheDir() {
  if (!cacheDirReady) {
    cacheDirReady = mkdir(CACHE_DIR, { recursive: true })
      .then(() => undefined)
      .catch((error) => {
        cacheDirReady = null;
        throw error;
      });
  }
  return cacheDirReady;
}

function isAllowedImageHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "liquipedia.net" ||
    normalized.endsWith(".liquipedia.net") ||
    normalized === "liquipedia.org" ||
    normalized.endsWith(".liquipedia.org") ||
    normalized === "rlesport.gg" ||
    normalized.endsWith(".rlesport.gg")
  );
}

function snapBucket(requested: number | null): number {
  const target = requested && Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_SIZE;
  for (const b of SIZE_BUCKETS) {
    if (target <= b) return b;
  }
  return SIZE_BUCKETS[SIZE_BUCKETS.length - 1];
}

function cachePathFor(originalUrl: string, bucket: number): string {
  const hash = createHash("sha256").update(originalUrl).digest("hex");
  return path.join(CACHE_DIR, `${hash}-${bucket}.webp`);
}

async function freshCachedFile(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    if (!s.isFile() || s.size === 0) return false;
    return Date.now() - s.mtimeMs < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

async function cachedFileExists(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isFile() && s.size > 0;
  } catch {
    return false;
  }
}

function serveCacheFile(res: ServerResponse, filePath: string, etag: string, cacheStatus: "HIT" | "MISS" | "STALE") {
  res.writeHead(200, {
    "Content-Type": "image/webp",
    "Cache-Control": "public, max-age=2592000, stale-while-revalidate=2592000",
    ETag: etag,
    "X-Cache": cacheStatus
  });
  createReadStream(filePath).pipe(res);
}

async function fetchUpstreamBuffer(targetUrl: URL): Promise<Buffer | null> {
  const fetchHeaders = {
    "User-Agent": "RLCS-Stats/1.0",
    Referer: "https://liquipedia.net/",
    Accept: "image/avif,image/webp,image/*,*/*;q=0.8"
  };
  let response = await fetch(targetUrl.toString(), { headers: fetchHeaders, redirect: "follow" });
  if (!response.ok && targetUrl.pathname.includes("/images/thumb/")) {
    const rawPath = targetUrl.pathname
      .replace("/images/thumb/", "/images/")
      .replace(/\/\d+px-[^/]+$/, "");
    const rawUrl = new URL(rawPath, targetUrl.origin);
    response = await fetch(rawUrl.toString(), { headers: fetchHeaders, redirect: "follow" });
  }
  if (!response.ok || !response.body) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.startsWith("text/")) return null;

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength && contentLength > MAX_UPSTREAM_BYTES) return null;

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_UPSTREAM_BYTES) return null;
  return Buffer.from(arrayBuffer);
}

const inflight = new Map<string, Promise<void>>();

async function generateVariant(
  cachePath: string,
  targetUrl: URL,
  bucket: number
): Promise<boolean> {
  const existing = inflight.get(cachePath);
  if (existing) {
    await existing;
    return cachedFileExists(cachePath);
  }
  const work = (async () => {
    const raw = await fetchUpstreamBuffer(targetUrl);
    if (!raw) return;
    const optimized = await new Bun.Image(raw)
      .resize(bucket, bucket, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .buffer();
    const tmp = `${cachePath}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmp, optimized);
    await rename(tmp, cachePath);
  })().finally(() => {
    inflight.delete(cachePath);
  });
  inflight.set(cachePath, work);
  await work;
  return cachedFileExists(cachePath);
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

    const sizeParam = Number(url.searchParams.get("size"));
    const bucket = snapBucket(Number.isFinite(sizeParam) ? sizeParam : null);
    const cachePath = cachePathFor(targetUrl.toString(), bucket);
    const etag = `"${path.basename(cachePath, ".webp")}"`;

    await ensureCacheDir();

    if (await freshCachedFile(cachePath)) {
      serveCacheFile(res, cachePath, etag, "HIT");
      return;
    }

    const ok = await generateVariant(cachePath, targetUrl, bucket);
    if (ok) {
      serveCacheFile(res, cachePath, etag, "MISS");
      return;
    }
    // Upstream fetch failed — if a stale cached copy exists, serve it rather than 502.
    if (await cachedFileExists(cachePath)) {
      serveCacheFile(res, cachePath, etag, "STALE");
      return;
    }
    json(res, 502, { error: "Failed to fetch image" });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Image proxy failed" });
  }
}
