# Slice 1 — Multi-stat grid on the Stat Page

**Parent:** [plans/multi-stat-grid.md](./multi-stat-grid.md)
**Type:** AFK
**Related:** [docs/adr/0001-stat-page-multi-stat-grid.md](../docs/adr/0001-stat-page-multi-stat-grid.md), [docs/pages/stat.md](../docs/pages/stat.md)

## What to build

Turn the Stat Page from a single-leaderboard view into a uniform grid of leaderboard cards — one per selected stat — with all selection state encoded in the URL.

End-to-end behavior:

- Route stays `/stats/:statKey`. The path stat is the *anchor* (always rendered, first in the grid). Additional stats live in a CSV query param `?stats=goals,demos`. The `stats` param holds extras only and is dropped from the URL when empty.
- The page H1 reads **"Leaderboards"** (generic). The subheading describes the active filter scope, e.g. `Per Game · S25 Spring · 3s · Regional only`. The per-stat label moves to each card's own H4.
- The `StatPicker` becomes a multi-select. Toggling a stat adds or removes it from the URL. Toggling the anchor re-anchors to the next stat in the list (path rewrite via `navigate`). Toggling the last remaining stat is a no-op.
- Cards render in a grid using the same density as EventPage's `event-pick-stat-grid` (`showTeamLogos={false}`, `showTeams={false}`, `playerImageSize="large"`).
- Each card has a per-card ✕ to remove itself. The ✕ is **hidden on the last remaining card** to enforce the "≥1 stat" invariant.
- Selection is capped at **8 stats** total (1 anchor + up to 7 extras). The picker disables further options once at cap.
- Unknown stat keys in the URL are **silently dropped** on load and the URL is rewritten without them.
- All controls are global: `type` (player/team), `mode` (avg/total), `sort`, `limit` (See All), and the filter row (`season`, `split`, `event`, `gameMode`, `includeLans`). Existing single-stat URLs (`/stats/score`) render exactly as before — one card.
- Per-card loading, error, and empty states are independent (one card failing does not block the others). All cards refetch in parallel when filters change.

Internal structure (not separately deliverable): introduce a `useStatSelection` hook that owns the URL ↔ ordered-stat-list contract (parse, serialize, toggle, re-anchor, cap, bogus-key filter); a `useStatLeaderboards` hook that fans out `api.statsTop` calls and exposes per-key `{ data, loading, error }`; and a `<StatCardGrid>` component that is pure render. The page becomes a thin composition.

## Acceptance criteria

- [ ] An existing `/stats/score` URL with no `stats=` param renders one card, identical in content to today's single-leaderboard view.
- [ ] A URL like `/stats/score?stats=goals,demos&gameMode=3s&scope=regional&tier=none` renders three cards in order: score, goals, demos.
- [ ] Adding a stat via the picker appends it to `?stats=` and renders a new card; removing one updates the URL and the grid.
- [ ] Toggling the anchor stat in the picker re-anchors the path to the next stat and removes the old anchor (no flicker beyond normal navigation).
- [ ] Per-card ✕ removes that card and updates the URL accordingly; the ✕ is hidden when only one card remains.
- [ ] Selecting an 8th stat works; the picker disables further options at 8.
- [ ] `?stats=goals,nonsense` loads with only `goals` rendered and the URL rewritten to drop `nonsense`.
- [ ] Page H1 reads "Leaderboards"; subheading reflects active filter scope and updates when filters change.
- [ ] All global controls (type, mode, sort, See All, filters) update every card.
- [ ] Cards render with EventPage card density (no team logos / team column, large player photos).
- [ ] One stat failing to load shows an error panel inside its card only; siblings render normally.
- [ ] Changing a filter triggers parallel refetch of every card; the page does not white-screen between refetches (prior data stays visible while loading where reasonable).
- [ ] No backend / API changes.

## Blocked by

None — can start immediately.
