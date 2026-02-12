# Source Data Handoff

Date: 2026-02-12
Audience: Source data owners

## Goal

These are data corrections needed in source files so the dataset is structurally and logically consistent.

## High-Priority Corrections

### 1) Incomplete game rows in Open 5 (Raleigh Major)

Source file:
- `2025 Season Database - 2025 Birmingham Major (2).csv`

Affected records:
- `20250509-173321-2025-Raleigh Major -Open 5-GSL-LQF-G2`
  - only `STR1VE ESPORTS` exists (`1` row, `1` player: `SSA-P-10231`)
  - expected: both teams and 6 total player rows for a normal 3v3 game
- `20250509-173321-2025-Raleigh Major -Open 5-GSL-LQF-G5`
  - `STR1VE ESPORTS` has `2` rows:
    - `SSA-P-10147`
    - `SSA-P-10234`
  - `WE'LL HAVE A LOOK` has `3` rows:
    - `SSA-P-10218`
    - `SSA-P-10251`
    - `SSA-P-10259`
  - expected: `3` player rows per team

Requested fix:
- Complete missing player/team rows for the two records above, or remove orphan rows if those games are not valid.

### 2) Winner flag disagrees with scoreline

Source file:
- `2022-23 Season Database - 22-23 Season (5).csv`

Affected record:
- `20230609-185336-2022-23-Spring-Invitational-Double Elim-LR1-G2`
  - `ICE ESPORTS`: goals `1`, winner flag `false`
  - `RED CROWN ESPORTS`: goals `0`, winner flag `true`

Requested fix:
- Align winner flag with the scored result (or correct goals if winner flag is authoritative).

### 3) Conflicting best-of value in the same series context

Source file:
- `2022-23 Season Database - 22-23 Season (5).csv`

Affected context:
- Season `2022-23`, Split `Winter`, Regional `Invitational`, Stage `Playoffs`, Round `R1`, Teams `ATK` vs `SRZ`

Observed:
- best-of values include both `5` and `7`
- conflicting row appears at match ID `20230224-202213-2022-23-Winter-Invitational-Playoffs-R1-G3`

Requested fix:
- Set one canonical best-of value for this series context.

### 4) Player identity duplication (same player name, multiple IDs)

Affected player names and IDs:
- `twnzr` -> `SSA-P-10148`, `SSA-P-10177`
- `pnda.` -> `SSA-P-10066`, `SSA-P-10084`
- `lazybear` -> `SSA-P-10147`, `SSA-P-10174`
- `Paarthurnax.` -> `SSA-P-10045`, `SSA-P-10101`
- `ckeno.` -> `SSA-P-10070`, `SSA-P-10110`

Requested fix:
- Provide canonical ID mapping for each name and update source records to a single ID per player.

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

Match IDs to review:

- `LIMITLESS` / `YOUNG MONEY CLAN` (`2024` `Major 1` `Open Qualifier 1`)
  - QF:
    - `20240302-17.00-2024-Major 1-Open Qualifier 1-Playoffs-QF-G1`
    - `20240302-17.01-2024-Major 1-Open Qualifier 1-Playoffs-QF-G2`
    - `20240302-17.02-2024-Major 1-Open Qualifier 1-Playoffs-QF-G3`
    - `20240302-17.03-2024-Major 1-Open Qualifier 1-Playoffs-QF-G4`
  - SF (LIMITLESS path):
    - `20240204-170919-2024-Major 1-Open Qualifier 1-Playoffs-SF-G1`
    - `20240204-171655-2024-Major 1-Open Qualifier 1-Playoffs-SF-G2`
    - `20240204-172543-2024-Major 1-Open Qualifier 1-Playoffs-SF-G3`
    - `20240204-173640-2024-Major 1-Open Qualifier 1-Playoffs-SF-G4`
    - `20240204-174719-2024-Major 1-Open Qualifier 1-Playoffs-SF-G5`
    - `20240204-175524-2024-Major 1-Open Qualifier 1-Playoffs-SF-G6`
  - SF (YOUNG MONEY CLAN path):
    - `20240204-170742-2024-Major 1-Open Qualifier 1-Playoffs-SF-G1`
    - `20240204-171434-2024-Major 1-Open Qualifier 1-Playoffs-SF-G2`
    - `20240204-172355-2024-Major 1-Open Qualifier 1-Playoffs-SF-G3`
    - `20240204-173300-2024-Major 1-Open Qualifier 1-Playoffs-SF-G4`
    - `20240204-174128-2024-Major 1-Open Qualifier 1-Playoffs-SF-G5`
    - `20240204-175049-2024-Major 1-Open Qualifier 1-Playoffs-SF-G6`
    - `20240204-175800-2024-Major 1-Open Qualifier 1-Playoffs-SF-G7`
  - GF:
    - `20240204-182029-2024-Major 1-Open Qualifier 1-Playoffs-GF-G1`
    - `20240204-183318-2024-Major 1-Open Qualifier 1-Playoffs-GF-G2`
    - `20240204-184328-2024-Major 1-Open Qualifier 1-Playoffs-GF-G3`
    - `20240204-185225-2024-Major 1-Open Qualifier 1-Playoffs-GF-G4`

- `BOT GAMING` (`2021-22` `Winter` `Regional Event 3`)
  - LQF:
    - `20220225-17.12-2021-22-Winter-Regional Event 3-Playoffs-LQF-G1`
    - `20220225-17.13-2021-22-Winter-Regional Event 3-Playoffs-LQF-G2`
    - `20220225-17.14-2021-22-Winter-Regional Event 3-Playoffs-LQF-G3`
    - `20220225-17.15-2021-22-Winter-Regional Event 3-Playoffs-LQF-G4`
  - LR1:
    - `20220225-194055-2021-22-Winter-Regional Event 3-Playoffs-LR1-G1`
    - `20220225-194833-2021-22-Winter-Regional Event 3-Playoffs-LR1-G2`
    - `20220225-195629-2021-22-Winter-Regional Event 3-Playoffs-LR1-G3`
  - LR2:
    - `20220226-170654-2021-22-Winter-Regional Event 3-Playoffs-LR2-G1`
    - `20220226-171625-2021-22-Winter-Regional Event 3-Playoffs-LR2-G2`
    - `20220226-172534-2021-22-Winter-Regional Event 3-Playoffs-LR2-G3`

- `AIPX` (`2021-22` `Winter` `Regional Event 2`, LR1)
  - `20220204-17.18-2021-22-Winter-Regional Event 2-Playoffs-LR1-G1`
  - `20220204-17.19-2021-22-Winter-Regional Event 2-Playoffs-LR1-G2`
  - `20220204-17.20-2021-22-Winter-Regional Event 2-Playoffs-LR1-G3`

- `TRADUIS SI TU PUES` (`2025` `Raleigh Major` `Open 6`, LR1)
  - `20250524-180116-2025-Raleigh Major-Open 6-Playoffs-LR1-G1`
  - `20250524-180857-2025-Raleigh Major-Open 6-Playoffs-LR1-G2`
  - `20250524-181559-2025-Raleigh Major-Open 6-Playoffs-LR1-G3`
  - `20250524-182338-2025-Raleigh Major-Open 6-Playoffs-LR1-G4`
  - `20250524-183337-2025-Raleigh Major-Open 6-Playoffs-LR1-G5`

Requested fix:
- Confirm correct bracket order and correct event dates/round labels where needed.

## Expected Deliverables From Source Team

- Corrected CSV rows for the listed match IDs.
- Canonical player-ID mapping for the 5 duplicated names.
- Confirmation notes on which records were corrected vs removed.

## Success Criteria

- No orphan/single-team game rows remain.
- Winner flags align with game outcomes.
- Best-of value is consistent per series context.
- One unique ID per player name.
- Playoff round progression is chronological and bracket-consistent.
