# C16 Best-of Conflict Report (Focused)

Date: 2026-02-08
Scope: Only category `r_best_of_variants` (series where `Best of` has conflicting values within one `series_id`).

## Summary
- Affected series: 7
- Affected matches: 33
- Affected rows: 198

## Files
- `c16-best-of-conflicting-series.csv`
  - One row per affected series
  - Includes metadata, team pair, best_of values, match/game/row counts, source file
- `c16-best-of-conflicts-per-game.csv`
  - One row per (series_id, game_number)
  - JSON map of `team -> Best of` so conflicts are obvious by game
- `c16-best-of-conflicting-rows.csv`
  - Full row-level extract for all affected rows

## Notes
- All affected series have `best_of_values = {5,7}`.
- Most come from `2021-22 Season Database - 21-22 Fall Split Regionals 1-3.csv`; one comes from `2022-23 Season Database - 22-23 Fall Split (1).csv`.
