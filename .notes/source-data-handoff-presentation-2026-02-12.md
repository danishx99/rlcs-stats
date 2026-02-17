# Source Data Handoff

Date: 2026-02-13
Audience: Source data owners

## Goal

These are source-data corrections still needed so the dataset is structurally and logically consistent.

## Status Update

Closed since previous handoff:
- Issue 1 (winner flag vs score mismatch) is resolved.
- Issue 2 (best-of conflict in ATK vs SRZ) is resolved.

Still open:
- Issue 3 (player identity duplication) remains unresolved and expanded by one additional name.

## Open High-Priority Corrections

### 3) Player identity duplication (same player name, multiple IDs)

Canonical IDs are sourced from the `players` table (primary handle/alias match), then compared against `stats` rows:

| Primary Handle (`players`) | Canonical ID (`from players table`) | Incorrect ID(s) in `stats` | Platform ID(s) | Correct Rows | Incorrect Rows | Season |
|---|---|---|---|---:|---:|---|
| `Ram` | `SSA-P-10045` | `SSA-P-10101` | canonical: `Steam|76561199013801159|0`; incorrect: `Steam|76561199013801159|0` | 1 | 51 | `2021-22` |
| `twnzr` | `SSA-P-10148` | `SSA-P-10177` | canonical: `Steam|76561199083377130|0`; incorrect: `Steam|76561199083377130|0` | 172 | 20 | `2024` |
| `ckeno` | `SSA-P-10070` | `SSA-P-10110` | canonical: `Epic|42ce51ef35a94d5c9e458e7ca4a6a4bb|0`; incorrect: `Epic|42ce51ef35a94d5c9e458e7ca4a6a4bb|0` | 2 | 19 | `2021-22` |
| `Lazybear` | `SSA-P-10147` | `SSA-P-10174` | canonical: `Steam|76561198251626568|0`; incorrect: `Steam|76561198251626568|0` | 81 | 18 | `2024` |
| `Shadow` | `SSA-P-10128` | `SSA-P-10103` | canonical: `Steam|76561198875402590|0`; incorrect: `Steam|76561198963293081|0` | 201 | 15 | `2022-23` |
| `pnda` | `SSA-P-10084` | `SSA-P-10066` | canonical: `Steam|76561198308845936|0`; incorrect: `[missing]` | 113 | 12 | `2021-22` |

Requested fix:
- Update source rows so each listed player uses only the canonical ID shown above.

### 4) Remaining series completeness gaps

Affected series IDs:
- `6c9afee974c1e4d186a20c2ca91e4f16`
- `fc550c08025962e5910328450c36d4c4`

Requested fix:
- Validate source exports for these series and backfill missing games/rows as needed.

### 5) Playoff progression timeline inconsistencies

Affected team contexts:
- `LIMITLESS`
- `YOUNG MONEY CLAN`
- `BOT GAMING`
- `AIPX`
- `TRADUIS SI TU PUES`

Primary regions/splits involved:
- `2024` / `Major 1` / `Open Qualifier 1`
- `2021-22` / `Winter` / `Regional Event 2` and `Regional Event 3`
- `2025` / `Raleigh Major` / `Open 6`

Requested fix:
- Confirm correct bracket order and correct event dates/round labels where needed.

## Expected Deliverables From Source Team

- Corrected CSV rows for the listed records/contexts.
- Canonical player-ID mapping for the 6 duplicated names.
- Confirmation notes on which records were corrected vs removed.

## Success Criteria

- One unique ID per player name.
- Remaining series completeness gaps are resolved.
- Playoff round progression is chronological and bracket-consistent.
