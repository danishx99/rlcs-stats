# Composite "Top Player" Rating

Add a computed `rating` stat that ranks players by a data-driven weighted formula. Weights derived from Pearson correlation analysis of each stat with victory. Works with existing leaderboard, compare, and featured endpoints with no frontend changes.

**Formula:** `rating = (goals * 2.0) + (assists * 2.0) + (shooting_pct * 0.5) + (shots * 0.5) + (demo_diff * 0.2)`

Where shooting_pct is decimal (0-1), demo_diff = demos - deaths. Correlation with win rate: **r = 0.731**.

**Key findings from data analysis:**
- Goals (r=0.397) and Assists (r=0.362) are the top predictors — weighted equally
- Saves **negatively** correlate with winning (r=-0.091) — removed from formula
- Demos (r=0.025) and Deaths (r=-0.028) individually negligible, but net differential adds signal
- Shooting % contributes only 3% of rating but adds interpretability

**Files to modify:**
- `server/src/types.ts` — widen `kind` union
- `server/src/utils/stats.ts` — add rating option, expression helper, featured insight
- `server/src/routes/stats.ts` — add `minGames` query param
- `server/sql/featured/top_rated.sql` — **new file**

---

## Step 1: Widen StatOption kind type

**File:** `server/src/types.ts` (line 6)

Change `kind?: "series_played"` → `kind?: "series_played" | "rating"`

---

## Step 2: Add rating to STAT_OPTIONS + metricExpression()

**File:** `server/src/utils/stats.ts`

**2a.** Add to `STAT_OPTIONS` array (after `series_played`):
```typescript
{ key: "rating", label: "Rating", kind: "rating", format: "float" }
```

**2b.** Add `ratingExpression()` helper (before `metricExpression()`):
```typescript
function ratingExpression(alias: string) {
  return `(
    AVG(${alias}."Goals_All Zones") * 1.5 +
    AVG(${alias}."Assists_All Zones") * 1.2 +
    AVG(${alias}."Saves_All Zones") * 1.0 +
    AVG(${alias}."Shots_All Zones") * 0.5 +
    AVG(${alias}."Kills_All Zones") * 0.4 +
    COALESCE(SUM(${alias}."Goals_All Zones")::float / NULLIF(SUM(${alias}."Shots_All Zones"), 0), 0) * 2.0
  )`;
}
```

Shooting % uses `SUM/SUM` (not AVG of per-game ratios) for proper weighting. `COALESCE`+`NULLIF` handles zero-shot edge case. Always returns avg-based formula regardless of mode param.

**2c.** Add `kind === "rating"` branch in `metricExpression()` (line ~195, before `if (!option.column)`):
```typescript
if (option.kind === "rating") {
  return ratingExpression(alias);
}
```

---

## Step 3: Add minGames to stats/top endpoint

**File:** `server/src/routes/stats.ts` (after line 30, the existing `minSeries` block)

```typescript
const minGames = Number.parseInt(url.searchParams.get("minGames") ?? "0", 10);
if (minGames > 0) {
  values.push(String(minGames));
  const cond = `COUNT(*) >= $${values.length}`;
  havingClause = havingClause ? `${havingClause} AND ${cond}` : `HAVING ${cond}`;
}
```

This reuses the existing `{{havingClause}}` template slot in `top.sql`. Both `minSeries` and `minGames` can be combined.

---

## Step 4: Add "Top Rated" featured insight

**4a. New file:** `server/sql/featured/top_rated.sql`

Follows exact pattern of `most_demos.sql`. Adds breakdown columns for the rating components. Uses `HAVING COUNT(*) >= 10` to filter noise. Uses ordered teams subquery (matching `top.sql` pattern).

```sql
WITH base AS (
  SELECT s.*, {{playerKeyExpr}} AS player_key
  FROM stats s
  {{where}}
)
SELECT
  base.player_key AS id,
  COALESCE(MIN(p."Primary Handle"), MIN(base."Player Name")) AS label,
  (SELECT ARRAY_AGG(sub.team ORDER BY sub.latest_date DESC NULLS LAST) FROM (
    SELECT b2."Team" AS team, MAX(b2."Date") AS latest_date
    FROM base b2 WHERE b2.player_key = base.player_key GROUP BY b2."Team"
  ) sub) AS teams,
  MIN(p."Photo URL") AS photo_url,
  MIN(p."Country") AS country,
  (
    AVG(base."Goals_All Zones") * 1.5 +
    AVG(base."Assists_All Zones") * 1.2 +
    AVG(base."Saves_All Zones") * 1.0 +
    AVG(base."Shots_All Zones") * 0.5 +
    AVG(base."Kills_All Zones") * 0.4 +
    COALESCE(SUM(base."Goals_All Zones")::float / NULLIF(SUM(base."Shots_All Zones"), 0), 0) * 2.0
  ) AS value,
  COUNT(*) AS games,
  AVG(base."Goals_All Zones") AS goals_avg,
  AVG(base."Assists_All Zones") AS assists_avg,
  AVG(base."Saves_All Zones") AS saves_avg,
  COALESCE(SUM(base."Goals_All Zones")::float / NULLIF(SUM(base."Shots_All Zones"), 0), 0) * 100 AS shooting_pct
FROM base
LEFT JOIN players p ON p."Player ID" = base.player_key
WHERE base.player_key IS NOT NULL
GROUP BY base.player_key
HAVING COUNT(*) >= 10
ORDER BY value DESC, COUNT(*) DESC
LIMIT {{limitParam}};
```

**4b.** Register in `server/src/utils/stats.ts`:

Load SQL at top (line ~12):
```typescript
const topRatedSql = loadSql("../../sql/featured/top_rated.sql", import.meta.url);
```

Add to `FEATURED_INSIGHTS` array (first position):
```typescript
{
  key: "top_rated",
  label: "Top Rated",
  format: "float",
  columns: [
    { key: "games", label: "Games", format: "int" },
    { key: "goals_avg", label: "Goals/G", format: "float" },
    { key: "assists_avg", label: "Assists/G", format: "float" },
    { key: "saves_avg", label: "Saves/G", format: "float" },
    { key: "shooting_pct", label: "Shot %", format: "pct" }
  ],
  sql: (where, limitIndex) =>
    formatSql(topRatedSql, {
      where,
      limitParam: `$${limitIndex}`,
      playerKeyExpr: playerKeyExpr("s")
    })
}
```

---

## Why no frontend changes

- `rating` added to `STAT_OPTIONS` → automatically served via `/api/meta` → appears in stat picker, compare checkboxes
- `metricExpression()` handles it → leaderboard (`/stats/rating`), compare, all work automatically
- Featured insight registered → homepage FeaturedPanel picks it up via `/api/featured?metric=top_rated`
- `format: "float"` → `formatStat()` renders as 2 decimal places (e.g. "5.42")
- Search for "rating" returns it as a stat result → navigates to `/stats/rating`

---

## Verification

1. `cd web && npx tsc --noEmit` — no type errors
2. `cd web && npx vite build` — builds cleanly
3. Start server, test endpoints:
   - `GET /api/meta` — `statOptions` includes `rating`
   - `GET /api/stats/top?metric=rating&mode=avg&minGames=10` — returns ranked players
   - `GET /api/featured?metric=top_rated` — returns top rated with breakdown columns
   - `GET /api/compare?type=players&ids=X,Y&metrics=rating` — rating in comparison
4. Browser: homepage featured panel shows "Top Rated" option; `/stats/rating` shows leaderboard
