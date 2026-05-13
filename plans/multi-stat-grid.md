# PRD: Multi-Stat Grid on the Stat Page

**Status:** Ready for implementation
**Related:** [ADR 0001 — Stat Page: multi-stat uniform grid with anchored URL](../docs/adr/0001-stat-page-multi-stat-grid.md), [docs/pages/stat.md](../docs/pages/stat.md)

## Problem Statement

A visitor on the Stat Page (`/stats/:statKey`) can only view one leaderboard at a time. To compare players or teams across multiple stats — e.g. "who's top in goals, and how do those same players rank in saves and demos?" — they have to navigate between separate Stat Pages, losing the rest of their filter context as they go. The view is also not shareable as a multi-stat snapshot.

## Solution

Turn the Stat Page into a dashboard of side-by-side leaderboard cards, one per selected stat. All cards share the same filter scope (season, split, event, game mode, LAN inclusion) and presentation (player/team, per-game/total, sort, limit). Selection is fully encoded in the URL so any view is shareable and bookmarkable.

The anchor stat lives in the path (`/stats/:statKey`) and extra stats live in a CSV query param (`?stats=goals,demos`). Existing single-stat URLs continue to work unchanged.

## User Stories

1. As a stats analyst, I want to view multiple leaderboards on one page, so that I can compare how players rank across several metrics without losing my filter context.
2. As a stats analyst, I want to add a stat to my view from a category-based picker, so that I can find the metric I want quickly.
3. As a stats analyst, I want to remove an individual leaderboard via a per-card ✕, so that I can curate my view without scrolling back to a toggle row.
4. As a stats analyst, I want the page to always show at least one leaderboard, so that the page never reaches an empty/broken state.
5. As a stats analyst, I want my multi-stat view to be shareable via URL, so that I can send a colleague the exact comparison I'm looking at.
6. As a stats analyst, I want a Share button on the page, so that I can copy the URL or invoke the native share sheet on mobile without manually copying the address bar.
7. As a stats analyst, I want all leaderboards to react to a single set of filters (season, split, event, game mode, LAN inclusion), so that every card describes the same match scope.
8. As a stats analyst, I want a single player/team toggle and a single per-game/total toggle that apply to every card, so that the page is internally consistent.
9. As a stats analyst, I want a single sort toggle that applies to every card, so that I can flip the whole view between "top" and "lowest" in one action.
10. As a stats analyst, I want a single "See All" toggle that expands every card from 10 to 50 rows, so that I can deep-dive without per-card configuration.
11. As a stats analyst, I want the page heading to reflect the active filter scope rather than a single stat, so that the page reads correctly when several stats are shown.
12. As a stats analyst, I want each card to carry its own stat label, so that I can identify which leaderboard is which at a glance.
13. As a stats analyst, I want each card to render in EventPage-style density (no team logos, large player photos), so that the grid is visually consistent with the rest of the product and fits comfortably on screen.
14. As a stats analyst, I want each card to load and surface errors independently, so that one slow or failed stat doesn't block the rest of the view.
15. As a stats analyst, I want to be capped at 8 stats simultaneously, so that the page stays legible and the server isn't overwhelmed by per-card fan-out.
16. As a stats analyst, I want unknown stat keys in the URL to be silently dropped, so that stale or hand-edited links still load whatever valid stats they contain instead of erroring out.
17. As a stats analyst on a 1v1 view, I want the Teams toggle to be disabled, so that I can't accidentally request a meaningless team leaderboard.
18. As a stats analyst, I want changing season to clear split and event, and changing split to clear event, so that I never land in an invalid filter combination.
19. As a stats analyst on 3v3, I want LAN events excluded by default but easily re-enabled, so that the default view is the regional regular season I usually want.
20. As a stats analyst, I want selecting a LAN event from the dropdown to auto-enable Include LAN Events, so that I don't get a confusing empty result because of an implicit filter.
21. As a stats analyst clicking a stat that's already selected, I want it to be removed (unless it's the last one), so that the picker behaves symmetrically as a multi-select.
22. As a stats analyst removing the anchor stat from the URL, I want the page to re-anchor to the next stat in my list without any visual jump or layout shift, so that the action feels seamless.
23. As a stats analyst on the last remaining card, I want the ✕ button to be hidden, so that the "at least one stat" invariant is communicated by absence rather than a dead control.
24. As a stats analyst with a single stat selected, I want the URL to drop the `stats=` parameter entirely, so that bookmarks for the common case stay clean.
25. As a returning user with an old `/stats/:statKey` bookmark, I want it to render exactly as before (one leaderboard, all filters intact), so that nothing I've shared previously breaks.
26. As a developer or AI agent reading the code, I want the URL/state logic and the data-fetching fan-out extracted into focused hooks, so that I can change the page UI without breaking the contract.

## Implementation Decisions

### Architecture

- **Route stays as `/stats/:statKey`.** The path stat is the *anchor* — the first stat in the ordered set. Extra stats are stored in a CSV query param `?stats=goals,demos`. The `stats` param holds extras only; the anchor is never repeated in it. When no extras are selected, the param is dropped from the URL.
- **The page renders a uniform grid of cards** — anchor and extras have no visual distinction. Page H1 is generic ("Leaderboards"); each card's H4 carries the stat label.
- **All controls are global**: `type` (player/team), `mode` (avg/total), `sort` (asc/desc), `limit` (10/50), and the filter row (`season`, `split`, `event`, `gameMode`, `includeLans`). Per-card overrides are explicitly out of scope.
- **At least one stat must always be selected.** Removing the anchor re-anchors to the next stat in the list. The per-card ✕ is hidden on the last remaining card.
- **Cap of 8 cards** (1 anchor + up to 7 extras). Picker disables further selections at the cap.
- **Unknown stat keys are silently dropped** on URL parse (validated against `api.metaColumns()` categories). The URL is rewritten without them.

### Modules

- **`useStatSelection` (deep module).** Owns the URL ↔ stat-list contract. Given `searchParams`, `statKey`, `navigate`, `setSearchParams`, and the set of valid stat keys, exposes:
  - `orderedStats: string[]` — anchor first, then extras, filtered to valid keys.
  - `toggleStat(key)` — symmetric add/remove; re-anchors when toggling off the anchor; blocked when adding past the cap; blocked when removing the last remaining stat.
  - `removeStat(key)` — same as toggle-off; used by per-card ✕.
  - `cap`, `isAtCap`, `count`.
  - Internally handles CSV parse/serialize, `?stats=` dropping when empty, anchor-path rewrite via `navigate`, and bogus-key filtering.
- **`useStatLeaderboards` (deep module).** Given `orderedStats` + the global query object (filters + mode + type + sort + limit), fans out `api.statsTop` calls and returns `{ dataByKey, loadingByKey, errorByKey }`. Mirrors the existing EventPage pattern (`leaderboardMap` / `loadingStats` / `statLoadErrors`) but lifted into a reusable hook. Refetches in parallel via `Promise.allSettled` when any input changes; preserves prior data for keys still selected (no flicker on add).
- **`<StatCardGrid>`.** Pure render component. Props: `orderedStats`, `dataByKey`, `loadingByKey`, `errorByKey`, `statLabels`, `onRemove`. Maps stats to `Leaderboard` cards with EventPage card density (`showTeamLogos={false}`, `showTeams={false}`, `playerImageSize="large"`). Hides the ✕ when `orderedStats.length === 1`. No data fetching, no URL knowledge.
- **`<ScopeSubheading>`** (or inline helper). Formats the active filter scope into the H1 subheading (e.g. `Per Game · S25 Spring · 3s · Regional only`).
- **`useShare` (small extraction).** Lifts `handleShare` from EventPage into a reusable hook so the new Share button on the Stat Page can reuse the same behavior (Web Share API where available, clipboard fallback, busy/message state).
- **`StatPage.tsx`** is rewritten as a thin composition of the above. Existing meta-loading and filter-cascade behavior is preserved.

### API Contracts

- No backend changes. The page fans out N parallel `api.statsTop` calls per filter change (capped at 8).
- Each call uses the same scope/filter params; only `metric` differs.

### URL Encoding

- `stats` is CSV (`?stats=goals,demos`). Order is preserved and significant (defines card order after the anchor).
- Anchor not repeated in `stats`.
- Unknown keys silently filtered on load; URL is rewritten to canonical form (drop empty `stats=`, drop unknown keys).

### Behavior Edge Cases

- **Game mode change clears all filters** (existing behavior preserved); does not clear `stats=`.
- **1v1 mode** disables the Teams toggle; the rest of the multi-stat behavior is unchanged.
- **Adding a stat while at cap (8)**: picker shows the additional options as disabled with a tooltip.
- **Removing the anchor with extras present**: navigate to `/stats/{next}` with `stats=` rewritten to exclude the just-removed key and the new anchor.
- **Removing the only stat**: ✕ hidden, picker toggle off is a no-op.

## Out of Scope

- Per-card overrides of `type`, `mode`, `sort`, or `limit`.
- Mixed player/team in one view.
- Drag-to-reorder cards (order is determined by selection order in the URL).
- A "suggested stats" quick-toggle row (rejected during design — picker + per-card ✕ is sufficient).
- Capping or batching of `api.statsTop` calls beyond the 8-stat selection cap (relies on browser parallelism).
- Backend changes (new endpoints, batch-fetch endpoint, schema migration).
- A standalone `/stats` route with no anchor — anchor is always in the path.
- Mobile-specific layout work beyond making the grid responsive (cards stack on narrow viewports via existing CSS patterns).
- Animation/transition polish when adding or removing cards.

## Further Notes

- See [ADR 0001](../docs/adr/0001-stat-page-multi-stat-grid.md) for the rationale behind each design choice and the rejected alternatives (hero+grid layout, per-card filters, suggested-stat toggle row).
- The existing `StatPicker` component supports multi-select (already used that way by EventPage); no API change expected. Verify during implementation that the dropdown trigger label reads sensibly when multiple stats are selected (suggested: "N stats selected" once `selected.length > 1`).
- The card render is intentionally identical to EventPage's `event-pick-stat-grid` so users carry a consistent mental model between pages. Reuse the existing CSS classes where it makes sense rather than introducing parallel ones.
- The `useShare` extraction is small but worth doing now since both pages need it; doing it inline twice would invite drift.
