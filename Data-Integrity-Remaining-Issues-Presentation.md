# Data Integrity Presentation (Non-Technical)

Date: 2026-02-08  
Scope: Remaining series-level issues grouped by pair + context: Season, Split, Regional, Stage, Round, and normalized team pair.

## Executive Summary
- We checked **1160** pair-and-context groups in total.
- **30** groups still need cleanup.
- **1130** groups are currently clean.
- Current issue rate: **2.59%**.
- Categories are now grouped exactly as requested: Not Enough Games, Duplicate Games, and Cross-Day mismatch.


## What The Remaining Issues Mean
- Not enough games: matchups with too few games for the declared BoX, or game numbering that starts late/skips numbers when no duplicates exist.
- Duplicate games: matchups with repeated game labels (more match records than distinct game numbers).
- Cross-day mismatch: the same matchup context appears across multiple `Day` values, which can split `series_id`.

## Issue Type Counts
| Issue Type | Affected Groups |
|---|---:|
| Not enough games | 24 |
| Duplicate games | 4 |
| Cross-day mismatch | 2 |

## Validation Basis
- Grouping key used for validation: normalized 2-team pair + `Season` + `Split` + `Regional` + `Stage` + `Round`.
- `series_id` was intentionally not used for completeness checks.
- Classification rule used:
  - If duplicate game labels exist, classify as Duplicate Games.
  - Otherwise, if game count is below BoX minimum or numbering starts late/skips, classify as Not Enough Games.

## 1) Not Enough Games
### 1) ATOMIC ESPORTS vs OUT OF RETIREMENT
- Where: 2021-22, Fall - Regional Event 2 - Swiss - Round 3
- Declared format: Bo5
- Games found: 2 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 1, 2
- Match IDs:
  - `20211112-190636-2021-22-Fall-Regional Event 2-Swiss-3-G1`
  - `20211112-191525-2021-22-Fall-Regional Event 2-Swiss-3-G2`

### 2) AUFBAU vs DIGITAL DEVILS
- Where: 2021-22, Fall - Regional Event 3 - Swiss - Round 2
- Declared format: Bo5
- Games found: 2 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 2, 3
- Numbering concern: game sequence starts late or has skips.
- Match IDs:
  - `20211126-180537-2021-22-Fall -Regional Event 3-Swiss-2-G2`
  - `20211126-181336-2021-22-Fall -Regional Event 3-Swiss-2-G3`

### 3) AUFBAU vs DAPPER DOGS
- Where: 2021-22, Fall - Regional Event 3 - Swiss - Round 4
- Declared format: Bo5
- Games found: 1 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 1
- Match IDs:
  - `20211126-175840-2021-22-Fall -Regional Event 3-Swiss-4-G1`

### 4) DIGITAL DEVILS vs ICE ESPORTS
- Where: 2021-22, Spring - Regional Event 1 - Double Elim - Round UQF
- Declared format: Bo5
- Games found: 2 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 2, 3
- Numbering concern: game sequence starts late or has skips.
- Match IDs:
  - `20220506-181610-2021-22-Spring-Regional Event 1-Double Elim-UQF-G2`
  - `20220506-182408-2021-22-Spring-Regional Event 1-Double Elim-UQF-G3`

### 5) AIPX GAMING vs ROYALTY ESPORTS
- Where: 2021-22, Winter - Regional Event 1 - Playoffs - Round LR1
- Declared format: Bo5
- Games found: 1 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 1
- Match IDs:
  - `20220122-170938-2021-22-Winter-Regional Event 1-Playoffs-LR1-G1`

### 6) AIPX GAMING vs ROYALTY ESPORTS
- Where: 2021-22, Winter - Regional Event 1 - Playoffs - Round LR2
- Declared format: Bo5
- Games found: 3 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 2, 3, 4
- Numbering concern: game sequence starts late or has skips.
- Match IDs:
  - `20220122-171809-2021-22-Winter-Regional Event 1-Playoffs-LR2-G2`
  - `20220122-172645-2021-22-Winter-Regional Event 1-Playoffs-LR2-G3`
  - `20220122-173539-2021-22-Winter-Regional Event 1-Playoffs-LR2-G4`

### 7) SUZAKU vs TEAM ESPIONAGE
- Where: 2021-22, Winter - Regional Event 3 - Groups - Round 3
- Declared format: Bo5
- Games found: 2 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 1, 2
- Match IDs:
  - `20220225-190800-2021-22-Winter-Regional Event 3-Groups-3-G1`
  - `20220225-191541-2021-22-Winter-Regional Event 3-Groups-3-G2`

### 8) ICE ESPORTS vs RED CROWN ESPORTS
- Where: 2022-23, Spring - Invitational - Double Elim - Round LR1
- Declared format: Bo5
- Games found: 1 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 1
- Match IDs:
  - `20230609-185336-2022-23-Spring-Invitational-Double Elim-LR1-G1`

### 9) AIPX GAMING vs ASTRONIC ESPORTS
- Where: 2022-23, Winter - Cup - Groups - Round 1
- Declared format: Bo5
- Games found: 2 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 1, 2
- Match IDs:
  - `20230210-170905-2022-23-Winter-Cup-Groups-1-G1`
  - `20230210-172623-2022-23-Winter-Cup-Groups-1-G2`

### 10) ORLANDO PIRATES vs UNITY
- Where: 2022-23, Winter - Cup - Groups - Round 1
- Declared format: Bo5
- Games found: 2 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 1, 2
- Match IDs:
  - `20230210-170732-2022-23-Winter-Cup-Groups-1-G1`
  - `20230210-172158-2022-23-Winter-Cup-Groups-1-G2`

### 11) ORLANDO PIRATES vs TEAM FUSION
- Where: 2022-23, Winter - Cup - Groups - Round 2
- Declared format: Bo5
- Games found: 2 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 1, 2
- Match IDs:
  - `20230210-175036-2022-23-Winter-Cup-Groups-2-G1`
  - `20230210-180535-2022-23-Winter-Cup-Groups-2-G2`

### 12) DIGITAL DEVILS vs FUZION ESPORT
- Where: 2022-23, Winter - Cup - Groups - Round 3
- Declared format: Bo5
- Games found: 2 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 1, 2
- Match IDs:
  - `20230210-184549-2022-23-Winter-Cup-Groups-3-G1`
  - `20230210-185745-2022-23-Winter-Cup-Groups-3-G2`

### 13) DIGITAL DEVILS vs NIXUH
- Where: 2022-23, Winter - Invitational - Groups - Round 2
- Declared format: Bo5
- Games found: 2 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 1, 2
- Match IDs:
  - `20230224-182415-2022-23-Winter-Invitational-Groups-2-G1`
  - `20230224-183149-2022-23-Winter-Invitational-Groups-2-G2`

### 14) ORLANDO PIRATES vs RED CROWN ESPORTS
- Where: 2022-23, Winter - Invitational - Groups - Round 3
- Declared format: Bo5
- Games found: 2 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 1, 2
- Match IDs:
  - `20230224-184635-2022-23-Winter-Invitational-Groups-3-G1`
  - `20230224-185426-2022-23-Winter-Invitational-Groups-3-G2`

### 15) LIMITLESS vs YOUNG MONEY CLAN
- Where: 2024, Major 1 - Open Qualifier 2 - Playoffs - Round GF
- Declared format: Bo7
- Games found: 4 (minimum expected: 4, maximum possible: 7)
- Game numbers present: 2, 3, 4, 5
- Numbering concern: game sequence starts late or has skips.
- Match IDs:
  - `20240218-190431-2024-Major 1-Open Qualifier 2-Playoffs-GF-G2`
  - `20240218-191405-2024-Major 1-Open Qualifier 2-Playoffs-GF-G3`
  - `20240218-192302-2024-Major 1-Open Qualifier 2-Playoffs-GF-G4`
  - `20240218-193550-2024-Major 1-Open Qualifier 2-Playoffs-GF-G5`

### 16) LIMITLESS vs YOUNG MONEY CLAN
- Where: 2024, Major 1 - Open Qualifier 2 - Playoffs - Round SF
- Declared format: Bo7
- Games found: 1 (minimum expected: 4, maximum possible: 7)
- Game numbers present: 1
- Match IDs:
  - `20240218-185619-2024-Major 1-Open Qualifier 2-Playoffs-SF-G1`

### 17) ASTRONIC ESPORTS vs LIMITLESS
- Where: 2024, Major 1 - Open Qualifier 3 - Playoffs - Round GF
- Declared format: Bo7
- Games found: 4 (minimum expected: 4, maximum possible: 7)
- Game numbers present: 2, 3, 4, 5
- Numbering concern: game sequence starts late or has skips.
- Match IDs:
  - `20240303-191514-2024-Major 1-Open Qualifier 3-Playoffs-GF-G2`
  - `20240303-192243-2024-Major 1-Open Qualifier 3-Playoffs-GF-G3`
  - `20240303-193214-2024-Major 1-Open Qualifier 3-Playoffs-GF-G4`
  - `20240303-194139-2024-Major 1-Open Qualifier 3-Playoffs-GF-G5`

### 18) ASTRONIC ESPORTS vs LIMITLESS
- Where: 2024, Major 1 - Open Qualifier 3 - Playoffs - Round SF
- Declared format: Bo7
- Games found: 1 (minimum expected: 4, maximum possible: 7)
- Game numbers present: 1
- Match IDs:
  - `20240303-190619-2024-Major 1-Open Qualifier 3-Playoffs-SF-G1`

### 19) CHOCCARANILLA vs DECIMATE GAMING
- Where: 2025, Birmingham Major - Open 1 - GSL - Round LQF
- Declared format: Bo5
- Games found: 1 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 3
- Numbering concern: game sequence starts late or has skips.
- Match IDs:
  - `20250117-161128-2025-Birmingham Major-Open 1-GSL-LQF-G3`

### 20) 2 1S MAINS 1 HALDEN vs MAESTROS DEL ESFERICO
- Where: 2025, Birmingham Major - Open 1 - GSL - Round UQF
- Declared format: Bo5
- Games found: 2 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 2, 3
- Numbering concern: game sequence starts late or has skips.
- Match IDs:
  - `20250117-152652-2025-Birmingham Major-Open 1-GSL-UQF-G2`
  - `20250117-171923-2025-Birmingham Major-Open 1-GSL-UQF-G3`

### 21) CHOCCARANILLA vs DECIMATE GAMING
- Where: 2025, Birmingham Major - Open 1 - GSL - Round UQF
- Declared format: Bo5
- Games found: 2 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 1, 2
- Match IDs:
  - `20250117-155511-2025-Birmingham Major-Open 1-GSL-UQF-G1`
  - `20250117-160218-2025-Birmingham Major-Open 1-GSL-UQF-G2`

### 22) BALL EATER vs LIMITLESS
- Where: 2025, Birmingham Major - Open 3 - GSL - Round LF
- Declared format: Bo5
- Games found: 2 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 1, 2
- Match IDs:
  - `20250228-200431-2025-Birmingham Major-Open 3-GSL-LF-G1`
  - `20250228-201212-2025-Birmingham Major-Open 3-GSL-LF-G2`

### 23) COSMICO ESPORTS vs WE LOVE FARMING
- Where: 2025, Raleigh Major - Open 5 - GSL - Round UQF
- Declared format: Bo5
- Games found: 2 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 1, 2
- Match IDs:
  - `20250509-171239-2025-Raleigh Major -Open 5-GSL-UQF-G1`
  - `20250509-171926-2025-Raleigh Major -Open 5-GSL-UQF-G2`

### 24) LOOKING FOR ORGANIZATION vs SPANISH PAP EN WORS
- Where: 2026, Boston Major - Open 1 - GSL - Round UQF
- Declared format: Bo5
- Games found: 3 (minimum expected: 3, maximum possible: 5)
- Game numbers present: 1, 2, 4
- Numbering concern: game sequence starts late or has skips.
- Match IDs:
  - `20251128-151407-2026-Boston Major-Open 1-GSL-UQF-G1`
  - `20251128-152057-2026-Boston Major-Open 1-GSL-UQF-G2`
  - `20251128-172835-2026-Boston Major-Open 1-GSL-UQF-G4`

## 2) Duplicate Games
### 1) ATK vs BRAVADO GAMING
- Where: 2021-22, Winter - Regional Event 2 - Playoffs - Round LF
- Declared format: Bo7
- Games found: 5, match records found: 6
- Game numbers present: 1, 2, 3, 4, 6
- Match IDs:
  - `20220206-172915-2021-22-Winter-Regional Event 2-Playoffs-LF-G2`
  - `20220206-175530-2021-22-Winter-Regional Event 2-Playoffs-LF-G6`
  - `20220206-180238-2021-22-Winter-Regional Event 2-Playoffs-LF-G6`
  - `20220206-192014-2021-22-Winter-Regional Event 2-Playoffs-LF-G1`
  - `20220206-193745-2021-22-Winter-Regional Event 2-Playoffs-LF-G3`
  - `20220206-194606-2021-22-Winter-Regional Event 2-Playoffs-LF-G4`

### 2) BRAVADO GAMING vs ROYALTY ESPORTS
- Where: 2021-22, Winter - Regional Event 2 - Playoffs - Round LSF
- Declared format: Bo7
- Games found: 3, match records found: 4
- Game numbers present: 1, 2, 3
- Match IDs:
  - `20220206-165023-2021-22-Winter-Regional Event 2-Playoffs-LSF-G1`
  - `20220206-181716-2021-22-Winter-Regional Event 2-Playoffs-LSF-G1`
  - `20220206-182554-2021-22-Winter-Regional Event 2-Playoffs-LSF-G2`
  - `20220206-183913-2021-22-Winter-Regional Event 2-Playoffs-LSF-G3`

### 3) ANTISOCIALES vs HEY (WITH RIZZ)
- Where: 2025, Raleigh Major - Open 5 - GSL - Round UQF
- Declared format: Bo5
- Games found: 4, match records found: 5
- Game numbers present: 2, 3, 4, 5
- Match IDs:
  - `20250509-171812-2025-Raleigh Major -Open 5-GSL-UQF-G4`
  - `20250509-172451-2025-Raleigh Major -Open 5-GSL-UQF-G5`
  - `20250509-173304-2025-Raleigh Major -Open 5-GSL-UQF-G3`
  - `20250509-174024-2025-Raleigh Major -Open 5-GSL-UQF-G2`
  - `20250509-174737-2025-Raleigh Major -Open 5-GSL-UQF-G5`

### 4) ASTRONIC ESPORTS vs COSMICO ESPORTS
- Where: 2026, Boston Major - Open 1 - GSL - Round UQF
- Declared format: Bo5
- Games found: 2, match records found: 3
- Game numbers present: 1, 3
- Match IDs:
  - `20251128-171039-2026-Boston Major-Open 1-GSL-UQF-G1`
  - `20251128-171845-2026-Boston Major-Open 1-GSL-UQF-G3`
  - `20251128-172541-2026-Boston Major-Open 1-GSL-UQF-G1`

## 3) Cross-Day Mismatch
### 1) ATK vs ORLANDO PIRATES
- Where: 2021-22, Winter - Regional Event 2 - Playoffs - Round UF
- Issue: Day differs inside one matchup context, which can split `series_id`.
- Match IDs:
  - `20220206-150755-2021-22-Winter-Regional Event 2-Playoffs-UF-G1 (Day=2)`
  - `20220206-151606-2021-22-Winter-Regional Event 2-Playoffs-UF-G2 (Day=3)`
  - `20220206-172310-2021-22-Winter-Regional Event 2-Playoffs-UF-G3 (Day=3)`
  - `20220206-173213-2021-22-Winter-Regional Event 2-Playoffs-UF-G4 (Day=3)`
  - `20220206-174051-2021-22-Winter-Regional Event 2-Playoffs-UF-G5 (Day=3)`
  - `20220206-175034-2021-22-Winter-Regional Event 2-Playoffs-UF-G6 (Day=3)`

### 2) NIXUH vs WHITE RABBIT GAMING
- Where: 2022-23, Winter - Invitational - Playoffs - Round QF
- Issue: Day differs inside one matchup context, which can split `series_id`.
- Match IDs:
  - `20230225-170838-2022-23-Winter-Invitational-Playoffs-QF-G1 (Day=1)`
  - `20230225-171733-2022-23-Winter-Invitational-Playoffs-QF-G2 (Day=2)`
  - `20230225-172553-2022-23-Winter-Invitational-Playoffs-QF-G3 (Day=2)`
  - `20230225-173454-2022-23-Winter-Invitational-Playoffs-QF-G4 (Day=2)`
  - `20230225-174411-2022-23-Winter-Invitational-Playoffs-QF-G5 (Day=2)`
  - `20230225-175244-2022-23-Winter-Invitational-Playoffs-QF-G6 (Day=2)`
