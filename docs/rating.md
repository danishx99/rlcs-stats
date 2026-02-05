# Player Rating

A single composite score that ranks players by their contribution to winning, derived from statistical analysis of RLCS match data.

## Formula

```
rating = (goals * 2.0) + (assists * 2.0) + (shooting_pct * 0.5) + (shots * 0.5) + (demo_diff * 0.2)
```

| Component | Weight | Description |
|-----------|--------|-------------|
| Goals per game | 2.0 | Direct scoring impact |
| Assists per game | 2.0 | Playmaking — data shows assists predict winning as strongly as goals |
| Shooting % | 0.5 | Shot efficiency (goals / shots, as decimal 0–1) |
| Shots per game | 0.5 | Offensive pressure |
| Demo differential | 0.2 | Net disruption (demos inflicted minus deaths received) |

All per-game values are denormalized from the 300-second baseline before aggregation.

## Methodology

Weights were derived empirically from the RLCS dataset using two analyses:

### 1. Win/Loss Gap Analysis

For each stat, compare the average value in winning games vs losing games:

| Stat | Win Avg | Loss Avg | Gap % |
|------|---------|----------|-------|
| Assists | 0.857 | 0.294 | +191% |
| Goals | 1.131 | 0.392 | +189% |
| Shooting % | 36.6% | 19.8% | +85% |
| Shots | 3.090 | 1.977 | +56% |
| Score | 402 | 288 | +40% |
| Demos | 0.706 | 0.662 | +6.6% |
| Deaths | 0.866 | 0.919 | -5.8% |
| Saves | 1.214 | 1.424 | **-14.7%** |

### 2. Pearson Correlation with Victory

Per-game correlation coefficient (r) of each stat with the Victory boolean:

| Stat | r |
|------|---|
| Goals | 0.397 |
| Score | 0.377 |
| Assists | 0.362 |
| Shots | 0.336 |
| Avg Boost | 0.124 |
| Ball Touches | 0.064 |
| Demos | 0.025 |
| Deaths | -0.028 |
| Saves | -0.091 |

### Key Findings

- **Assists are as predictive as goals.** Both have nearly identical correlation with winning (~0.36–0.40). The formula weights them equally at 2.0.
- **Saves negatively correlate with winning.** Teams that need more saves are typically losing (facing more shots). Saves are excluded from the formula.
- **Demos are nearly irrelevant individually** (r=0.025), but the net differential (demos minus deaths) adds modest signal, reflecting positional awareness and survivability.
- **Shooting % is partially redundant** with goals + shots but adds an interpretable efficiency dimension. Its low weight (0.5 on a 0–1 decimal) contributes ~3% of a typical rating.

### Weight Optimization

Multiple weight combinations were tested against player-level win rate using Pearson correlation. The final formula achieves **r = 0.731** with win rate across 158 players (min 10 games), compared to r = 0.621 for the original hand-tuned formula.

Validation by rating tier:

| Rating Tier | Avg Win Rate |
|-------------|-------------|
| Top quartile (4.5+) | 55.4% |
| Middle (3.4–4.5) | 42.2% |
| Bottom quartile (<3.4) | 24.6% |

## Typical Values

| Percentile | Rating |
|------------|--------|
| Min | 1.59 |
| 25th | 3.40 |
| Median | 3.88 |
| 75th | 4.43 |
| Max | 6.32 |

## Implementation

- **Server:** `server/src/utils/stats.ts` — `ratingExpression()` generates the SQL aggregate
- **SQL:** Rating is computed inline via `metricExpression()` with `kind: "rating"` — no stored column
- **Featured:** `server/sql/featured/top_rated.sql` — homepage "Top Rated" insight with breakdown columns (Goals/G, Assists/G, Shot %, Demo +/-)
- **Minimum games:** Featured insight requires 10+ games. The `/api/stats/top` endpoint accepts a `minGames` query parameter for custom thresholds.
- **Denormalization:** All count-based stats (goals, assists, shots, demos, deaths) are denormalized from the 300-second baseline using `Extra Time` before aggregation, so overtime games contribute actual counts rather than rates.
