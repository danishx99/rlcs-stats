# PRD: Milestone Stats & Arena Filter

**Status:** Ready for implementation
**Related:** [plans/multi-stat-grid.md](./multi-stat-grid.md), [docs/adr/0001-stat-page-multi-stat-grid.md](../docs/adr/0001-stat-page-multi-stat-grid.md)

## Problem Statement

A stats analyst on the Stat Page or Event Page can only pick from a narrow set of metrics — Goals, Assists, Saves, Demos, Shots, Score, Avg Speed, etc. They cannot ask "who has the most hat-tricks?", "who scores the most MVPs?", or "how many games has this player played?" without leaving the product or computing it themselves. They also cannot scope a view to a specific arena (e.g. "show me leaderboards on Champions Field, which usually shows up in game 5 of a series") even though every row carries an `Arena` value.

## Solution

Add six new synthetic stats to the picker so analysts can ask milestone-style questions directly:

- **Games Played** — total games in the filter scope.
- **Hat-tricks** — count of games where the player scored 3+ goals.
- **Saviours** — count of games where the player recorded 3+ saves.
- **Exterminations** — count of games where the player recorded 7+ demos.
- **MVPs** — count of games the player won as the top scorer on their team.
- **OT Games** — count of overtime games the player participated in.

These appear in a new **"Milestones"** group in the StatPicker (just below Core), and become selectable in every place the picker is used: Stat Page, Event Page pick-a-stat grid, and Compare Page.

Separately, add an **Arena filter** to the Stat Page and Event Page so analysts can scope leaderboards to a specific map variant. The filter is a searchable single-select dropdown, defaults to "All Arenas", and persists in the URL via `?arena=<name>`.

## User Stories

1. As a stats analyst, I want to see who scores the most hat-tricks across a season, so that I can identify clutch scorers regardless of total goal volume.
2. As a stats analyst, I want to see who collects the most MVP performances, so that I can identify players who consistently lead their winning team.
3. As a stats analyst, I want to see who plays the most overtime games, so that I can find players who routinely end up in pressure situations.
4. As a stats analyst, I want to see who racks up Exterminations (7+ demos in a game), so that I can spot demo specialists.
5. As a stats analyst, I want to see who records the most Saviours (3+ save games), so that I can spot defensive standouts.
6. As a stats analyst, I want to see total Games Played as a sortable stat, so that I can put low-volume comparisons in context.
7. As a stats analyst browsing the StatPicker, I want the new milestone stats grouped together under a "Milestones" heading, so that I can find them at a glance.
8. As a stats analyst, I want the "Milestones" group to sit just below "Core" in the picker, so that the most-used stats remain at the top while milestone counters are still prominent.
9. As a stats analyst toggling between per-game and total mode, I want milestone stats to ignore the toggle, so that "Hat-tricks" always reads as a meaningful total rather than a confusing rate.
10. As a stats analyst loading a Stat Page with a milestone stat as the anchor, I want the leaderboard sorted descending by default, so that the top performers appear first.
11. As a stats analyst on a Teams view, I want milestone stats hidden from the picker, so that I'm not tempted to select stats that don't have a clean team-level definition.
12. As a stats analyst opening a shared URL with milestone stats while in Teams mode, I want the milestone stats silently dropped from the URL, so that the page renders cleanly with whatever valid stats remain.
13. As a stats analyst, I want milestone stats available in the Compare page picker too, so that I can compare players head-to-head on these counters.
14. As a stats analyst, I want milestone stats available in the Event Page "pick a stat" grid, so that I can browse milestone leaderboards inside an event view.
15. As a stats analyst, I want to filter the Stat Page by arena, so that I can see leaderboards limited to Champions Field, Forbidden Temple, or any specific map.
16. As a stats analyst, I want to filter the Event Page by arena, so that I can drill into how a single event played on a specific map.
17. As a stats analyst opening the arena filter, I want each weather variant listed separately (e.g. "DFH Stadium" vs "DFH Stadium (Stormy)"), so that I can isolate exactly the map I'm interested in.
18. As a stats analyst, I want the arena filter to be a searchable single-select dropdown, so that I can type to narrow down 20+ map names quickly.
19. As a stats analyst, I want the arena filter to default to "All Arenas", so that I see the broadest view until I deliberately scope down.
20. As a stats analyst, I want my arena selection encoded in the URL via `?arena=<name>`, so that I can share or bookmark an arena-scoped view.
21. As a returning user with an existing Stat Page bookmark that has no `?arena=` parameter, I want the page to render exactly as before, so that previously shared links don't break.
22. As a stats analyst, I want the arena filter to apply to every leaderboard card on the page simultaneously, so that the page stays internally consistent.
23. As a stats analyst, I want the arena dropdown to show the same list on Stat Page and Event Page, so that the experience is consistent across pages.
24. As a stats analyst, I want the milestone leaderboards to respect every other active filter (season, split, event, game mode, LAN, arena), so that the result is scoped to the same matches as every other view on the page.
25. As a developer reading the picker code, I want milestone stats defined declaratively (a kind tag + a SQL expression in one place) rather than scattered across multiple SQL templates, so that adding the seventh milestone is a one-place change.

## Implementation Decisions

### New milestone stats

Six new entries are added to the StatPicker:

| Key | Label | Kind | Semantics |
|---|---|---|---|
| `games_played` | Games Played | `games_played` | `COUNT(*)` of game rows for the player in scope. |
| `hat_tricks` | Hat-tricks | `hat_tricks` | `COUNT(*) FILTER (WHERE "Goals_All Zones" >= 3)`. |
| `saviours` | Saviours | `saviours` | `COUNT(*) FILTER (WHERE "Saves_All Zones" >= 3)`. |
| `exterminations` | Exterminations | `exterminations` | `COUNT(*) FILTER (WHERE "Kills_All Zones" >= 7)`. |
| `mvps` | MVPs | `mvps` | Games where `Victory = true` and the player has the highest `Score_All Zones` on their team in that game (ties: all tied players credited). |
| `ot_games` | OT Games | `ot_games` | `COUNT(*) FILTER (WHERE "OT" = true)`. |

All milestone stats are **total-only** — the per-game / total toggle is ignored and the SQL always emits a count.

### Module changes

- **`STAT_OPTIONS` (server/src/utils/stats.ts)** — add the six new entries with their new `kind` values. No `column` field; format `int`.
- **`metricExpression()` (server/src/utils/stats.ts)** — extend to handle each new kind. For `games_played`, `hat_tricks`, `saviours`, `exterminations`, `ot_games` this is a `COUNT(*) [FILTER (…)]`. For `mvps` it requires a per-game pre-aggregation: compare each winning-team player's `Score_All Zones` against the per-(game, team) max. The cleanest shape is a window-function CTE (`RANK() OVER (PARTITION BY match_id, game_number, team ORDER BY "Score_All Zones" DESC)` filtered to `Victory = true` and `rank = 1`). This may not fit the single-expression `metricExpression()` contract — see Architectural Decisions below.
- **`categorizeStatOptions()` (server/src/utils/stats.ts)** — insert a new "Milestones" category immediately after "Core", containing the six new keys.
- **Stats top SQL templates (server/sql/stats/)** — accept an `arena` filter param and apply as `AND s."Arena" = $N` when present. Existing SQL stays untouched when `arena` is absent.
- **Event stats SQL templates (server/sql/events/)** — same arena filter wiring.
- **Stats top route (server/src/routes/stats.ts)** — parse `arena` from query; pass into the SQL formatter.
- **Event route (server/src/routes/events.ts)** — same.
- **`/api/meta`** — return an `arenas` list (distinct `Arena` values from `stats`, ordered alphabetically with `Unknown Map` last). Caches similarly to existing stat options.
- **`StatPicker.tsx`** — add a `hiddenKeys?: Set<string>` prop. Hidden keys are filtered out of every category. Callers in Teams mode pass `{games_played, hat_tricks, saviours, exterminations, mvps, ot_games}` so the Milestones group either shrinks or disappears entirely.
- **`useStatSelection`** — extend the "valid keys" set so that, in Teams mode, milestone keys are treated as invalid and silently dropped from the URL (same path as bogus keys today).
- **New `ArenaFilter` component** — searchable single-select dropdown, structurally similar to the existing `StatPicker` popover (button trigger, search input, scrollable list). Selecting an arena writes `?arena=<name>` to the URL; clearing it drops the param.
- **`StatPage.tsx` / `EventPage.tsx`** — render the `ArenaFilter` in the filter row; thread `arena` into the per-card query object passed to `useStatLeaderboards` (Stat Page) and the event-stats fetch (Event Page).
- **API client (`web/src/api/index.ts`)** — accept `arena?: string` in the `statsTop` and event-stats call signatures; serialize to query param.
- **Types (`web/src/types/api.ts`)** — add `arena?: string` to relevant query types; add `arenas: string[]` to the meta response.

### Architectural Decisions

- **MVP computation lives in SQL via a CTE, not in `metricExpression()`.** Because MVP requires per-game ranking before aggregation, treating it as a single in-place expression in the top-level SQL is awkward. Two options were considered:
  1. Wrap every milestone aggregation in a pre-aggregation CTE that emits one row per (player, game) with boolean flags (`is_hat_trick`, `is_saviour`, `is_exterm`, `is_mvp`, `is_ot`) plus the count, then `SUM` the flags in the outer query. Uniform, clean, but rewrites every stats SQL template.
  2. Keep current shape; `metricExpression()` returns a `COUNT FILTER` for the simple cases and a subquery / window expression for MVP. Less uniform but smaller blast radius.

  **Decision: option 2 for now.** MVP is the only stat that needs pre-aggregation; the others are clean `COUNT FILTER` expressions. If a second pre-aggregated stat lands, refactor to option 1.

- **Milestone stats are total-only by SQL construction, not by UI gating.** The picker still shows the avg/total toggle on the page when a milestone stat is selected; the toggle simply has no effect on the milestone cards. This keeps the toggle's behavior predictable when the user has *both* a milestone stat and a regular stat selected at once.

- **Arena filter is added to existing filter-cascade rules unchanged.** Changing season, split, event, or game mode does NOT clear `arena` (it's orthogonal). The arena set is global across the whole DB, not scoped per event.

- **`Unknown Map` is shown in the dropdown.** It represents real data (228 rows currently) and the user can choose to scope to it or away from it explicitly. We do not silently exclude it by default.

- **Milestone stats are silently dropped in Teams mode** — same mechanism as bogus stat-key filtering in `useStatSelection`. No user-visible warning, no auto-flip of the type toggle. Symmetric and predictable with existing URL-validation behavior.

### API Contracts

- `GET /api/stats/top` — gains optional `arena` query param. When present, restricts to rows where `Arena` matches exactly.
- `GET /api/events/...` (event stats endpoints that drive the pick-a-stat grid) — same `arena` param.
- `GET /api/meta` — response gains an `arenas: string[]` field, alphabetical with `Unknown Map` last.
- `GET /api/meta/stats` (or the existing stat options endpoint, whichever is canonical) — response includes the six new entries with `kind` set.

### URL Encoding

- Arena: `?arena=<URL-encoded-name>` (e.g. `?arena=Champions%20Field%20%28Day%29`).
- Existing Stat Page URLs without `arena` continue to work unchanged.
- Milestone stats use lowercase snake_case keys (`hat_tricks`, `ot_games`, etc.) consistent with the existing stat-key convention.

## Out of Scope

- Team-level definitions of milestone stats. In team mode they are hidden from the picker.
- Per-card overrides of the arena filter (e.g. one card on Champions Field, another on DFH).
- Normalizing arena weather variants into canonical names. We show all 21 distinct values separately.
- Adding an arena filter to the Compare page or Player profile pages.
- Adding milestone stats to the Featured Players panel on the home page.
- Tiebreak refinement for MVP beyond "all tied players get credit".
- New per-arena breakdown views (e.g. "show me this player's stats per map").
- Backfilling missing `Arena` values; "Unknown Map" stays as-is.
- A "Milestones only" preset filter on the StatPicker.

## Further Notes

- The `StatPicker` already supports multi-select and disabled keys (added in the multi-stat grid work). The `hiddenKeys` prop is new; consider whether `disabledKeys` should also support a "hidden" mode rather than introducing a parallel prop. Implementer's call during build.
- The MVP definition matches the simplest broadcast convention: top scorer on the winning team, ties shared. If a competing definition is added later (e.g. weighted by Goals/Assists/Saves), introduce it as a separate stat key rather than mutating `mvps`.
- The arena dropdown is structurally a near-duplicate of the existing event picker popover. Look for reuse opportunities (extract a generic `SearchableSelect` component) but don't force it if the shapes don't line up cleanly.
- When MVP SQL ships, watch for the case where two players on the winning team have the exact same `Score_All Zones`. By spec, both get credit. Verify with a test query before merging.
