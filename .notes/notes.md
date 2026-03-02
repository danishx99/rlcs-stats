# Data Notes

## Players CSV Header Mapping (2026-02-26)
- In `data/players/*.csv`, the join key header is `Unique ID` and must map to `players."Unique ID"` for joins against `stats."Unique ID"`.
- `Player ID` is a separate platform identifier and should not be used as the primary join key for player lookups.
- Player aliases for UI/profile should come from CSV column `AKA` (stored in `players.aka`), not `All Aliases`.

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


## Forfeits (FF)
When a team forfeits, the victor column shows **FF** for those games. This means fewer games than expected appear in a series (e.g. 3 games in a Bo5, 4 games in a Bo7).

## Series Explorer (2026-02-08)
- New `/api/series` endpoints and `/series` page use game winner reconstruction at game level:
  - Prefer `Victory` flags when exactly one team is flagged winner.
  - If no winner flags exist, fall back to unique higher team goals for that game.
  - If still ambiguous (ties/conflicts), winner remains unknown for that game.
- This keeps series score calculation aligned with compare-history behavior.

---

## Known Bugs

- **VALIANT roster page not loading** (2026-02-19): `/rosters/org%3AVALIANT` shows nothing. Needs investigation — could be a data issue or a query/routing problem.
- **2022-23 Spring event placements wrong** (2026-03-02): Event `/events/673fc38f3990e6aa263cbaf6e82ae8b0` (2022-23 / Spring, May 26–28 2023) has incorrect placements. Needs data investigation.
