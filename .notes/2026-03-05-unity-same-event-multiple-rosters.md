# UNITY 2022-23: Same Event Showing Multiple Rosters

Date: 2026-03-05
Owner: Danish/Codex investigation note

## Summary
For `org:UNITY`, the 2022-23 roster page shows multiple roster cards. This is not only across different events. The same event (`Winter / Open`) shows two different "starters" lineups, which should not happen under current product assumptions.

## Evidence (DB Query Result)
Validated against local Postgres (`statsdb`) by grouping `stats + series_roster` for:
- `Season = '2022-23'`
- `Team = 'UNITY'`

Observed rows:
- `Winter / Open`: roster A (`Blade, YoPeGo!, Potato`) - 2 series
- `Winter / Open`: roster B (`TechnicEagle75, YoPeGo!, Potato`) - 2 series
- `Winter / Invitational`: (`Blade, YoPeGo!, Potato`) - 4 series
- `Winter / Cup`: (`Blade, TechnicEagle75, YoPeGo!`) - 3 series
- `Spring / Invitational`, `Spring / Cup`, `Spring / Open`: (`Blade, Chace, Potato`)
- `Fall / Open`: (`BigFoot, Jeff, Potato`)
- `Fall / Cup`: (`TechnicEagle75, Jeff, Potato`)

## Why This Is A Problem
The same event should not present multiple **starter** rosters. This strongly suggests alternates/substitute appearances are being promoted to starters in roster construction.

## Suspected Root Cause
Current roster derivation uses `series_roster.starters` from observed participants and then merges/iterates by overlap. If a substitute appears in enough series, lineup snapshots can be treated as distinct starter rosters instead of one roster with alternates.

## Follow-up Direction
When reworking roster logic:
1. Define a canonical event-level starter roster rule (e.g., most frequent trio or bracket-registered starters).
2. Classify non-canonical participants as alternates, not separate starter rosters.
3. Preserve chronology, but prevent multiple starter cards for the same org+event unless explicitly supported as transfers/official roster lock changes.
