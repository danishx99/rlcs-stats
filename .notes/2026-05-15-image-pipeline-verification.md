# Verifying the image proxy in prod

Three ways to confirm the proxy is doing its job, ordered cheapest first.

## 1. Inspect the cache directory directly

The proxy writes WebP variants to `/app/cache/images` inside the API container, backed by the `image-cache` named volume in `docker-compose.prod.yml`. Healthy looks like a few hundred to a few thousand small files totaling a few MB.

```bash
docker compose -f docker-compose.prod.yml exec api sh -c \
  'du -sh /app/cache/images && ls /app/cache/images | wc -l'

# Healthy example:
#   12M     /app/cache/images
#   1423
```

Failure modes:
- `0K  0 files` → volume not mounted, or the route is broken (no requests are reaching it, or generation is failing silently).
- Cache growing into the gigabytes → unexpected; investigate. At ~15 KB average per variant, even 10,000 variants should be under 200 MB.

Sanity check on a few specific files:

```bash
# Largest cached files (should still be small — biggest bucket is 1024 px)
docker compose -f docker-compose.prod.yml exec api sh -c \
  'ls -lhS /app/cache/images | head -10'
```

## 2. `X-Cache` response header (recommended add)

Best ergonomics: add a `X-Cache: HIT|MISS` response header in `server/src/routes/image.ts`. Then every browser request shows HIT vs MISS in the Network tab → Headers section. Live visibility, zero ops setup.

To check in DevTools:

1. Open the site in a browser with DevTools open (F12).
2. Network tab → filter by **Img**.
3. Click any `/api/image?...` row → Headers → look for `x-cache: HIT` or `x-cache: MISS`.

Expect mostly HITs after the first day or two. Many MISSes after a week means cache isn't persisting (volume issue) or TTL is too short.

## 3. Per-request logging (heavier, optional)

If we ever want time-series data instead of point-in-time snapshots, add a counter in the route handler that increments HIT vs MISS and dumps the totals on an interval or via a `/api/image/stats` endpoint. Skip unless we need a dashboard.

## Key facts to remember

- Cache key is `sha256(url) + bucket`. Same URL + same size bucket → same cache file.
- TTL is **30 days** via mtime check (`Date.now() - mtimeMs < CACHE_TTL_MS`). After that, next request triggers a re-fetch and replace.
- If upstream fetch fails on a stale entry, we serve the stale copy rather than 502.
- Size buckets are `64 / 128 / 256 / 512 / 1024`. Requested `?size=N` snaps **up** to the nearest covering bucket. Default is 512.
- WebP quality is a flat `q80` across all sizes (we removed the per-size tier — marginal gain wasn't worth the complexity).
- Cache files do NOT auto-evict. If we ever want a size cap, would add an LRU sweep. At current file sizes, not worth it yet.

## When images don't change despite upstream update

If rlesport.gg replaces bytes at the same URL (e.g., `tehqoz.jpg` gets a new photo with the same filename):

- We serve the stale cached copy for up to 30 days.
- Then the next request after TTL expiry fetches fresh.

To force-refresh sooner, either:
- Manually delete the cache file: `rm /app/cache/images/{hash}-*.webp` (compute the sha256 of the URL).
- Lower the TTL temporarily.
- (Future) Add a purge endpoint like `DELETE /api/image?url=...`.

When the photo URL itself changes in the DB (e.g., `default_nologo.png` → `kayvee.jpg`), no cache flush is needed — the cache key changes with the URL, so the new URL just misses and fetches fresh.

## Player photo coverage (as of 2026-05-15)

- 211 players using `default_nologo.png` (~56%)
- 141 players with specific photos
- 27 players with NULL photo URL

A random sample of 10 default-photo players all genuinely return HTML 404 at `rlesport.gg/downloads/player_pics/{handle}.jpg`. So `default_nologo` reflects upstream reality, not a data bug. Coverage improves when the source CSV is updated and re-ingested.
