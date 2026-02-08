# Issue 2 Note: Player ID Drift and Duplicate IDs Within Match-Team Groups

Date: 2026-02-07

## Summary
The remaining integrity failure (`C04_player_uniqueness_within_match_team`) is caused by incorrect `Unique ID` assignments.

- Expected per (`Match ID`, `Team`) in 3v3: `3` rows and `3` distinct player IDs.
- Current failure count: `12` match-team groups.

## What Is Wrong
Two patterns were found:

1. Duplicate ID inside one team/game.
- Example: two different player names sharing the same `Unique ID` in the same match-team group.
- This causes `distinct_players = 2` with `rows = 3`.

2. ID drift for the same player name.
- `Eliakim` appears with many IDs (`SSA-P-10019` through `SSA-P-10041`) in `ORLANDO PIRATES` rows.
- Canonical mapping from `players` table indicates:
  - `EliakimZA, Eliakim -> SSA-P-10019`

## Affected Teams/Groups
- `RED CROWN ESPORTS`: 10 affected match-team groups
- `ORLANDO PIRATES`: 2 affected match-team groups

## Concrete Source Fix Targets
1. `ORLANDO PIRATES` (2 rows)
- Match IDs:
  - `20221111-185223-2022-23-Fall-Invitational-Swiss-3-G1`
  - `20221111-195709-2022-23-Fall-Invitational-Swiss-4-G3`
- `Player Name = Eliakim`
- Set `Unique ID = SSA-P-10019`

2. `RED CROWN ESPORTS` (10 rows)
- Match IDs:
  - `20230224-181939-2022-23-Winter-Invitational-Groups-2-G4`
  - `20230224-184635-2022-23-Winter-Invitational-Groups-3-G1`
  - `20230224-185426-2022-23-Winter-Invitational-Groups-3-G2`
  - `20230225-182159-2022-23-Winter-Invitational-Playoffs-QF-G1`
  - `20230225-182930-2022-23-Winter-Invitational-Playoffs-QF-G2`
  - `20230225-183658-2022-23-Winter-Invitational-Playoffs-QF-G3`
  - `20230225-184833-2022-23-Winter-Invitational-Playoffs-QF-G4`
  - `20230225-185627-2022-23-Winter-Invitational-Playoffs-QF-G5`
  - `20230225-190543-2022-23-Winter-Invitational-Playoffs-QF-G6`
  - `20230225-191436-2022-23-Winter-Invitational-Playoffs-QF-G7`
- `Player Name = Dapz (broken controller), Dapz`
- Set `Unique ID = SSA-P-10076`

## Impact
- Player-level identity is not stable for affected groups.
- Team/game aggregates relying on player uniqueness are unreliable until fixed.

## Validation After Source Fix + Reload
Run:

```bash
psql "postgres://stats:stats_pw@localhost:5432/statsdb" -P pager=off -f "sql/data-integrity.sql"
```

Expected:
- `C04_player_uniqueness_within_match_team = 0`
