# Slice 1 — Five simple milestone stats + team-mode hiding

**Parent:** [plans/milestone-stats-and-arena-filter.md](./milestone-stats-and-arena-filter.md)
**Type:** AFK

## What to build

Add five new synthetic "milestone" stats to the StatPicker, available everywhere the picker is used (Stat Page, Event Page pick-a-stat grid, Compare Page). Each is a per-player count derived from existing game-row data:

- **Games Played** — `COUNT(*)` of game rows in scope.
- **Hat-tricks** — games where `Goals_All Zones >= 3`.
- **Saviours** — games where `Saves_All Zones >= 3`.
- **Exterminations** — games where `Kills_All Zones >= 7`.
- **OT Games** — games where `OT = true`.

End-to-end behavior:

- A new **"Milestones"** category appears in the picker immediately below "Core". The five new stats are listed under it.
- Selecting a milestone stat fetches its leaderboard through the existing `api.statsTop` path. The new metric expressions are emitted by the existing `metricExpression()` helper — typically `COUNT(*) FILTER (WHERE …)` patterns. Games Played is `COUNT(*)`.
- Milestone stats are **total-only**. The avg/total toggle still renders on the page but has no effect on milestone cards — the SQL emits the same count regardless of mode.
- Default sort when a milestone stat is the Stat Page anchor is descending (top performers first), matching the existing default for counter-style stats.
- **In Teams mode, milestone stats are hidden** from the picker and silently dropped from the URL. The `StatPicker` gains an optional `hiddenKeys: Set<string>` prop; callers in team mode pass the milestone key set. The `useStatSelection` hook treats milestone keys as invalid when type=teams (same code path as bogus-key filtering — drop from list, rewrite URL).
- If a Stat Page URL deep-links to milestone stats while in Teams mode and dropping them leaves an empty selection, the page falls back to the existing single-stat default (the path anchor remains).
- Leaderboard rendering, formatting, and the per-card UI need no changes — these stats render as integer counts via the existing `format: "int"` path.

## Acceptance criteria

- [ ] The StatPicker shows a "Milestones" group directly below "Core" with five entries: Games Played, Hat-tricks, Saviours, Exterminations, OT Games.
- [ ] Selecting Hat-tricks on the Stat Page renders a leaderboard sorted descending by default, with integer counts.
- [ ] Saviours, Exterminations, and OT Games behave identically with their respective thresholds and the OT boolean filter.
- [ ] Games Played returns total game count per player matching `COUNT(*)` of `stats` rows in scope.
- [ ] Toggling per-game / total has no effect on any milestone card; values remain the same count.
- [ ] Milestone stats are selectable in the Event Page pick-a-stat grid and Compare Page picker.
- [ ] Switching the Stat Page type toggle to Teams removes the Milestones group from the picker.
- [ ] A URL like `/stats/hat_tricks?type=teams` silently drops `hat_tricks` and re-anchors to the default; URL is rewritten to canonical form.
- [ ] A URL like `/stats/score?stats=goals,hat_tricks&type=teams` renders only Score and Goals (drops `hat_tricks`); URL rewritten.
- [ ] Existing single-stat URLs (`/stats/score`, `/stats/goals`) render exactly as before — no regression.
- [ ] `/api/meta` (or the stat-options endpoint) exposes the five new entries with `kind` set so the picker can surface them.

## Blocked by

None — can start immediately.
