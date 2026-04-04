# Match ID Collision Report

Date: 2026-04-03

## Collided Match ID

`20260403-171413-2026-Paris Major-Open 5-GSL-UQF-G2`

## Issue Summary

This single `Match ID` contains 4 teams merged together (expected: exactly 2 teams per match):

- `ASTRONIC ESPORTS`
- `BANG BANG BOIS 2-1!!!`
- `TEAM HSK`
- `THE PUNISHERS`

## Impact

- 12 rows exist under this one match ID (expected: 6 rows for one 3v3 game)
- Critical integrity checks failing due to this collision: `C01`, `C02`, `C10`, `C19`
- 12 rows for this match ID have null `series_id`

## Bottom Line

This is the new blocker from the latest data drop. The rest of the increment looked good.
