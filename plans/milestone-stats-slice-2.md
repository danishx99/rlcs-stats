# Slice 2 — MVP milestone stat

**Parent:** [plans/milestone-stats-and-arena-filter.md](./milestone-stats-and-arena-filter.md)
**Type:** AFK

## What to build

Add the sixth milestone stat, **MVPs**, to the existing Milestones group introduced in Slice 1.

Definition: in each game the player **won**, if the player has the highest `Score_All Zones` on their team, that game counts as one MVP. Ties are credited to all tied players (i.e. `RANK() = 1` within `(match_id, game_number, team)`).

End-to-end behavior:

- A new entry **MVPs** is appended to the Milestones group in the StatPicker, available in every picker location (StatPage, EventPage pick-a-stat, ComparePage).
- The metric is computed via a per-game pre-aggregation in SQL. The cleanest shape is a window-function CTE that ranks each winning-team player by `Score_All Zones` within `(match_id, game_number, team)`, then counts rows where rank = 1.
- Reuses Slice 1's team-mode hiding infrastructure: hidden from picker in Teams mode and silently dropped from URLs in Teams mode.
- Total-only behavior identical to the other milestone stats (avg/total toggle has no effect).
- Default sort is descending when MVP is the Stat Page anchor.
- No changes required to per-card rendering — integer count format.

Implementation note: because MVP needs ranking before aggregation, it does not fit a single in-place expression in `metricExpression()` cleanly. Per the PRD, scope-limit the change: add MVP via a subquery or CTE-style expression while leaving the other milestone stats as simple `COUNT FILTER` expressions. If a second pre-aggregated stat lands later, refactor all milestones to a uniform pre-aggregation pattern.

## Acceptance criteria

- [ ] MVPs appears as an entry in the Milestones group in the picker, after OT Games.
- [ ] Selecting MVPs on the Stat Page renders a leaderboard of integer counts sorted descending.
- [ ] MVP count for a player equals the number of games where the player won AND has the top `Score_All Zones` on their team (ties shared).
- [ ] Per-game / total toggle has no effect on the MVP card.
- [ ] In Teams mode, MVPs is hidden from the picker and dropped from any URL containing it (reuses Slice 1 mechanism).
- [ ] MVPs is selectable in EventPage pick-a-stat and ComparePage.
- [ ] Spot-check on real data: pick a known event, identify a game manually, verify the MVP credit lines up with the SQL output.
- [ ] No regression to the other five milestone stats from Slice 1.

## Blocked by

- Slice 1 (`plans/milestone-stats-slice-1.md`) — depends on the Milestones group, team-mode hiding plumbing, and `kind`-dispatch path in `metricExpression()`.
