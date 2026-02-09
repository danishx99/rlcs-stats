# Data Integrity Presentation (Non-Technical)

Date: 2026-02-09  
Scope: Remaining series-level issues grouped by pair + context: Season, Split, Regional, Stage, Round, and normalized team pair.

## Executive Summary
- We checked **1156** pair-and-context groups in total.
- **3** issue rows remain.
- Current issue rate: **0.26%**.
- Categories are grouped as: Not Enough Games, Duplicate Games, and Cross-Day mismatch.

## Issue Type Counts
| Issue Type | Affected Rows |
|---|---:|
| Not enough games | 2 |
| Duplicate games | 1 |
| Cross-day mismatch | 0 |

## Validation Basis
- Grouping key: normalized 2-team pair + `Season` + `Split` + `Regional` + `Stage` + `Round`.
- `series_id` is not used for these checks.
- Classification rule:
  - Duplicate game labels => Duplicate Games.
  - Otherwise, insufficient game count for BoX or numbering that starts late/skips => Not Enough Games.
  - Multiple `Day` values in the same matchup context => Cross-Day mismatch.

## 1) Not Enough Games
### 1) CHOCCARANILLA vs DECIMATE GAMING
- Where: 2025, Birmingham Major - Open 1 - GSL - Round LQF
- Declared format: Bo5
- Games found: 1 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 3
- Numbering concern: starts late or has skips.
- Match IDs:
  - `20250117-161128-2025-Birmingham Major-Open 1-GSL-LQF-G3`

### 2) CHOCCARANILLA vs DECIMATE GAMING
- Where: 2025, Birmingham Major - Open 1 - GSL - Round UQF
- Declared format: Bo5
- Games found: 2 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 1, 2
- Match IDs:
  - `20250117-155511-2025-Birmingham Major-Open 1-GSL-UQF-G1`
  - `20250117-160218-2025-Birmingham Major-Open 1-GSL-UQF-G2`

## 2) Duplicate Games
### 1) DIGITAL DEVILS vs NIXUH
- Where: 2022-23, Winter - Invitational - Groups - Round 2
- Declared format: Bo5
- Games found: 2, match records found: 3
- Game numbers present: 1, 2
- Match IDs:
  - `20230224-182415-2022-23-Winter-Invitational-Groups-2-G1`
  - `20230224-182415-2022-23-Winter-Invitational-Groups-2-G2`
  - `20230224-183149-2022-23-Winter-Invitational-Groups-2-G2`

## 3) Cross-Day Mismatch
- No remaining cross-day mismatch issues were found.
