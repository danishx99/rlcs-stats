# Data Notes

reverse engineer bracket using matches
results page per event

## Event Name Abbreviations
In the last two seasons, event round designations were abbreviated:
- "Upper QF" → "UQF"
- "Lower SF" → "LSF"

The earlier sheets were **not** updated to match, so there is an inconsistency between older and newer seasons.

## Normalised Stats (per 300 seconds)

Source CSVs normalise count-based stats to 300 seconds (the standard game length). The CSV loader (`src/load-csv.ts`) **denormalizes at ingestion time**: for OT games with `Extra Time > 0`, each count-based stat is scaled back to actual counts via `Math.round(value * (300 + extraTime) / 300)`.

**Affected stats (16 base x 4 zones = 64 columns):**
Goals, Assists, Saves, Shots, Score, Kills, Deaths, Passes Given, Passes Received, 50/50s, Possession Losses, Interceptions, Self Touches, Small Pads Collected, Big Boosts Collected, Ball Touches — each with `_All Zones`, `_Defense Zone`, `_Neutral Zone`, `_Offense Zone` suffixes.

Rate/percentage columns (Average Speed, On Ground %, etc.) are **not** denormalized — they remain as rates.

After a re-import with `--truncate`, all stored values are true integer counts. Server-side queries use raw column references with no runtime denormalization.

---

## 1v1s
For 1v1 matches, the event type is listed as "1v1" under "regional".

## Forfeits (FF)
When a team forfeits, the victor column shows **FF** for those games. This means fewer games than expected appear in a series (e.g. 3 games in a Bo5, 4 games in a Bo7).

---

## TODO: Composite "Top Player" Rating

**Goal:** A single aggregated score to rank the best overall players, filterable by scope (series, split, season, all time) with a minimum games threshold (e.g., 50 games).

### Approach: Weighted Per-Game Average

A weighted sum of per-game averages from the core stat categories. More meaningful than the raw in-game score because we can weight stats that reflect actual impact.

**Proposed formula (per-game averages, All Zones):**

| Stat | Weight | Why |
|------|--------|-----|
| Goals | 1.5 | Direct impact on winning |
| Assists | 1.2 | Playmaking — undervalued by raw score |
| Saves | 1.0 | Defensive contribution |
| Shots | 0.5 | Offensive pressure (lower weight since goals already counted) |
| Kills (Demos) | 0.4 | Disruption, tactical value |
| Shooting % (Goals/Shots) | 2.0 | Efficiency — separates clinical finishers from shot spammers |

```
rating = (goals * 1.5) + (assists * 1.2) + (saves * 1.0) + (shots * 0.5) + (demos * 0.4) + (shooting_pct * 2.0)
```

### Alternative: Percentile-Based Rating

For each stat, calculate the player's percentile rank against all players in that scope, then average the percentiles. Produces a 0-100 score.

- **Pros:** Fair across stats with different ranges, intuitive 0-100 output.
- **Cons:** More expensive SQL (window functions), a player's rating shifts when others are added/removed, harder to explain.

### Alternative: Z-Score Composite

Standard deviations from mean for each stat, then weighted sum.

- **Pros:** Mathematically clean, highlights outliers well.
- **Cons:** Negative scores possible (confusing for display), assumes normal distributions.

### Recommendation

Start with **weighted per-game average** — it's transparent, cheap to compute, and easy to explain on the UI ("Rating based on goals, assists, saves, shots, demos, and shooting efficiency"). Can layer percentile-based on top later.

### Scoping & Implementation

- **Minimum games:** Already have `minSeries` on the API. Add `minGames` the same way (`HAVING COUNT(*) >= $n`).
- **Scope:** Use existing filter params (season, split, event) — no new API structure needed.
- **Implementation:** Add a `kind: "rating"` stat option in `metricExpression()` that expands to the weighted formula. The leaderboard/featured endpoints work with it out of the box.

---

### Available columns for the formula (rating)

All from `stats` table, `_All Zones` suffix:
- `Goals_All Zones`, `Assists_All Zones`, `Saves_All Zones`
- `Shots_All Zones`, `Kills_All Zones` (demos)
- `Score_All Zones` (raw in-game score — already a weighted composite)
- `Ball Touches_All Zones` (involvement)
- `Average Speed_All Zones`, `Average Boost_All Zones` (mechanical)
- `Victory` (boolean — can derive win rate)

---

## TODO: Search Result Behaviors by Type

### Player Search
e.g. "2die4" → Player profile page showing:
- All-time stats: Series Played, Goals, Assists, Demos, Saves
- Scope toggle (dropdown): All Time / Season / Regional-specific
- Profile should adapt stats to the selected scope

### Team Search
e.g. "Benchwarmers" → Team profile page showing:
- Seasons / Regionals competed in
- Roster
- Best result

### Stat Search
e.g. "Time in the air" → Top 10 leaderboard for that stat

### Regional / Split Search
e.g. "Fall Open" (regional) → Shows:
- Teams & Rosters who competed in that regional

e.g. "Fall Split" (split) → Shows:
- List of regionals within the split (Regional 1, Regional 2, Regional 3) with links to each
