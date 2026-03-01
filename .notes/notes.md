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

## 1v1s
For 1v1 matches, the event type is listed as "1v1" under "regional".

TODO: Handle 1v1 data separately from standard team formats (3v3) in API queries and UI presentation.

## Stats Page Future Scope
- TODO: Consider optional inclusion of non-SSA players in Stat Leaderboard view (do not enable by default yet).

## Forfeits (FF)
When a team forfeits, the victor column shows **FF** for those games. This means fewer games than expected appear in a series (e.g. 3 games in a Bo5, 4 games in a Bo7).

## Series Explorer (2026-02-08)
- New `/api/series` endpoints and `/series` page use game winner reconstruction at game level:
  - Prefer `Victory` flags when exactly one team is flagged winner.
  - If no winner flags exist, fall back to unique higher team goals for that game.
  - If still ambiguous (ties/conflicts), winner remains unknown for that game.
- This keeps series score calculation aligned with compare-history behavior.

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

---

## Known Bugs

- **VALIANT roster page not loading** (2026-02-19): `/rosters/org%3AVALIANT` shows nothing. Needs investigation — could be a data issue or a query/routing problem.
- **LAN player placements may be inaccurate** (2026-02-26): player results placement labels for international LAN events can be incorrect because current stats data often includes only SSA-involved match slices instead of the full event field.
