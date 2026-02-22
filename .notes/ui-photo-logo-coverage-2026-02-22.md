# UI Photo/Logo Coverage Checklist

Date: 2026-02-22
Purpose: Track where player photos and team logos were added, and what to test.

## 1) `web/src/components/Leaderboard.tsx`

Used on:
- `http://localhost:5173/stats/:statKey` (Stat page leaderboard)
- `http://localhost:5173/events/:eventName` (Event page leaderboards)

What to check:
- Player photo beside player name
- Team logos in the team list under each player

## 2) `web/src/components/FeaturedPanel.tsx`

Status:
- Currently not mounted anywhere (no page uses this component right now).

Testing note:
- If live testing is needed, wire it into a page first.

## 3) `web/src/pages/HomePage.tsx`

Route:
- `http://localhost:5173/`

Section:
- Featured cards ("Top Rated")

What to check:
- Team badge under each featured player shows team logo

## 4) `web/src/components/ComparePanel.tsx`

Used on:
- `http://localhost:5173/compare`

What to check:
- Compare stat cards show player photos
- Primary team line in cards shows team logo
- Head-to-head history table team names show logos

## 5) `web/src/components/CompareHistory.tsx`

Status:
- Currently not mounted (compare history rendering is inline inside `ComparePanel`).

Testing note:
- No current route exercises this component directly.

## 6) `web/src/pages/SeriesPage.tsx`

Route:
- `http://localhost:5173/series`

What to check:
- Series table Team A / Team B columns show logos
- Open a series row (modal): team labels and winner labels show logos

## 7) `web/src/pages/PlayerPage.tsx`

Route example:
- `http://localhost:5173/players/SSA-P-10054`

What to check:
- Results table opponent column shows team logo
- Teams tag section below results shows team logos

## 8) `web/src/pages/RosterPage.tsx`

Route example:
- `http://localhost:5173/rosters/org%3AFIVE%20FEARS`

Current behavior (per latest request):
- Player photos removed from starters/alternates
- Team-name buttons still use team logos

## Notes

- Stat-page avatar size was increased and image quality improved by upgrading Liquipedia thumbnail URLs to source image URLs before proxying.
- Team logo chips are now logo-only (no outline circle).
