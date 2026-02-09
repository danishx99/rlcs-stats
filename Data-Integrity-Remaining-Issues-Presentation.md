# Data Integrity Presentation (Non-Technical)

Date: 2026-02-09  
Scope: Remaining series-level issues grouped by pair + context: Season, Split, Regional, Stage, Round, and normalized team pair.

## Executive Summary
- We checked **1156** pair-and-context groups in total.
- **1** issue row remains.
- Current issue rate: **0.09%**.
- Categories are grouped as: Not Enough Games, Duplicate Games, and Cross-Day mismatch.

## Issue Type Counts
| Issue Type | Affected Rows |
|---|---:|
| Not enough games | 0 |
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
- No remaining not-enough-games issues were found.

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
