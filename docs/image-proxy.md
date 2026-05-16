# Image Proxy

The `/api/image` route fetches player and team images from allowed upstream hosts, resizes them to a fixed set of widths, encodes them as WebP, and caches the variants to disk. Browsers see a small, fast, retina-ready image instead of the multi-megabyte originals served by upstream hosts.

Originals from `rlesport.gg` are often 20–30 MB JPEGs. A 512 px WebP variant is typically 15 KB — a ~2000× reduction.

## Request shape

```
GET /api/image?url=<encoded upstream URL>&size=<requested px>
```

| Param | Required | Default | Notes |
|---|---|---|---|
| `url` | yes | — | Must be on an allowed host (`liquipedia.net`, `liquipedia.org`, `rlesport.gg`, subdomains of either) |
| `size` | no | `512` | Requested width in pixels. Snaps **up** to the nearest size bucket |

The frontend never builds these URLs by hand — use `proxyImageUrl(url, { size })` in `web/src/utils/normalize.ts`.

## Size buckets

| Bucket | Used for |
|---|---|
| 64 | Tiny inline avatars (rare) |
| 128 | Inline player / team avatars (20–48 px CSS display at 2× DPR) |
| 256 | Card thumbnails |
| 512 | Default. Profile heroes, compare page |
| 1024 | Event bracket images, large hero cards |

`?size=N` snaps up to the nearest covering bucket — `?size=80` and `?size=128` both serve the 128 bucket. Anything above 1024 is capped at 1024.

WebP quality is a single `q80` across all buckets. We previously tiered quality per size (q68 → q82); the gain was marginal and the complexity wasn't worth it.

## Cache

Cached variants live at `process.env.IMAGE_CACHE_DIR` (defaults to `cache/images`). In production this is mounted from the named volume `image-cache` defined in `docker-compose.prod.yml`.

**Cache key:** `sha256(originalUrl) + bucket`. Two requests for the same upstream URL at the same size always resolve to the same file. Filenames look like:

```
8e963dd350a9f98235592103156c399a861ea08e5bf8fbb622d0cd698f581854-512.webp
```

**TTL:** 30 days, measured against the file's `mtime`. On a request, if the cached file is younger than 30 days it's served immediately. If it's older (or missing), the proxy re-fetches the upstream original, regenerates the WebP, and writes atomically (`.tmp-pid-ts` → `rename`).

**Stale-as-fallback:** if upstream is unreachable after the TTL expires, the existing stale file is served rather than a 502.

**In-flight dedupe:** concurrent cold requests for the same cache key share a single fetch + encode via an in-process `Map<cachePath, Promise>`. Followers await the leader.

No automatic eviction. At ~15 KB per variant, even thousands of unique URLs stay well under 100 MB. Add an LRU sweep only if this changes.

## Response headers

| Header | Value |
|---|---|
| `Content-Type` | `image/webp` |
| `Cache-Control` | `public, max-age=2592000, stale-while-revalidate=2592000` |
| `ETag` | `"<cache-key>"` (the basename of the cache file) |
| `X-Cache` | `HIT`, `MISS`, or `STALE` |

`X-Cache` values:
- **HIT** — served from disk cache, file was fresh
- **MISS** — fetched from upstream and encoded in this request
- **STALE** — upstream fetch failed past TTL; served the old cached copy

Open DevTools → Network → click any `/api/image?...` request → Headers to verify the pipeline is hitting cache in production.

## Observation

Quick health check on prod:

```bash
docker compose -f docker-compose.prod.yml exec api sh -c \
  'du -sh /app/cache/images && ls /app/cache/images | wc -l'
```

Healthy looks like a few hundred to a few thousand small files totaling a few MB. `0K  0 files` means the volume isn't mounting or the route is broken.

See `.notes/2026-05-15-image-pipeline-verification.md` for the full verification checklist.

## Upstream-changed images

The cache key is the **URL**, not the URL's contents. If upstream replaces the bytes at a fixed URL (e.g., uploads a new photo over `tehqoz.jpg`):

- The stale cached copy is served for up to 30 days.
- The next request after TTL expiry refetches and replaces.

To force-refresh sooner, delete the cache file directly (compute `sha256(url)` and `rm cache/images/<hash>-*.webp`).

When the URL itself changes in the database (e.g., a player's `Photo URL` is updated from `default_nologo.png` to `kayvee.jpg`), no cache action is needed — the new URL hashes to a different key and fetches fresh on first request.

## Implementation

- Route handler: `server/src/routes/image.ts`
- Bun.Image ambient types: `server/types/bun-image.d.ts` (avoids pulling in `@types/bun`, which conflicts with vite under `skipLibCheck: false`)
- Frontend helper: `proxyImageUrl()` in `web/src/utils/normalize.ts`
- Requires Bun ≥ 1.3.14 (for `Bun.Image`). Pinned in `Dockerfile.api`.
