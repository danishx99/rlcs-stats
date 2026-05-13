# Slice 3 — Arena filter on Stat Page and Event Page

**Parent:** [plans/milestone-stats-and-arena-filter.md](./milestone-stats-and-arena-filter.md)
**Type:** AFK

## What to build

Add an Arena filter to the Stat Page and Event Page so a stats analyst can scope leaderboards to a specific map (e.g. "Champions Field", "DFH Stadium (Stormy)").

End-to-end behavior:

- A new searchable single-select **Arena dropdown** appears in the filter row on the Stat Page and on the Event Page. UI shape mirrors the existing StatPicker popover: a button trigger, a search input, and a scrollable list.
- Default state is **"All Arenas"** (no filter applied). Selecting an arena writes `?arena=<URL-encoded-name>` to the URL; clearing it drops the param.
- Each weather variant is shown separately (e.g. "DFH Stadium", "DFH Stadium (Day)", "DFH Stadium (Stormy)") — no normalization. The dropdown lists every distinct `Arena` value present in the `stats` table, alphabetical with `Unknown Map` last.
- The list comes from `/api/meta`, which gains a new `arenas: string[]` field. Cached server-side similarly to existing meta options.
- The `arena` value threads into every stat-fetching call on both pages. On the Stat Page it applies to every leaderboard card in parallel (all cards refetch when arena changes). On the Event Page it applies to the pick-a-stat grid and any other leaderboards on that page.
- Arena filter is orthogonal to other filters — changing season/split/event/game mode does NOT clear `arena`.
- Existing URLs without `?arena=` render exactly as before. Bookmarks stay valid.
- Backend: every relevant stats SQL template accepts an optional `arena` predicate. When present, adds `AND s."Arena" = $N` to the WHERE clause. When absent, the SQL is untouched.

## Acceptance criteria

- [ ] `/api/meta` response includes `arenas: string[]` listing every distinct `Arena` value in the `stats` table, alphabetical with `Unknown Map` last.
- [ ] Stat Page filter row shows an Arena dropdown with a search input.
- [ ] Event Page filter row shows the same Arena dropdown.
- [ ] Default selection is "All Arenas"; no `arena` param on the URL.
- [ ] Selecting an arena writes `?arena=<URL-encoded-name>` to the URL and refetches every leaderboard on the page in parallel.
- [ ] Selecting "All Arenas" (or clearing the selection) drops the `arena` param from the URL.
- [ ] A URL like `/stats/score?arena=Champions%20Field` loads with the dropdown pre-selected to "Champions Field" and the leaderboard scoped to that arena.
- [ ] An invalid arena value in the URL is silently dropped on load (consistent with bogus-stat-key behavior) and the URL is rewritten.
- [ ] Changing season, split, event, or game mode does not clear the arena selection.
- [ ] The arena dropdown's search filters the list as the user types (case-insensitive substring).
- [ ] Existing Stat Page and Event Page URLs without `?arena=` render identically to today (no regression).
- [ ] Spot-check on real data: select "Champions Field" on a Stat Page with `gameMode=3s`; verify leaderboards reflect only Champions Field games.

## Blocked by

None — independent of Slices 1 and 2.
