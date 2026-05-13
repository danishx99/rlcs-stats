# Stat Page: multi-stat uniform grid with anchored URL

The Stat Page was originally a single-leaderboard view at `/stats/:statKey`. We extended it to display multiple leaderboards side-by-side as cards, with selection persisted in the URL so views are shareable.

## Decision

- **URL shape:** anchor stat stays in the path (`/stats/:statKey`); additional stats live in a CSV query param (`?stats=goals,demos`). The `stats` param holds *only* the extras; when no extras are selected the param is dropped. This preserves every existing `/stats/:statKey` URL and keeps the common single-stat case clean.
- **Picker is symmetric.** The StatPicker is multi-select. The "anchor" is just the first stat in the ordered set (path + query). Removing the anchor re-anchors to the next stat in the list. At least one stat must always be selected — the page can never reach an empty state.
- **All controls are global.** `type` (player/team), `mode` (avg/total), `sort`, `limit`, and the filter row (`season`, `split`, `event`, `gameMode`, `includeLans`) apply to every card. Per-card overrides were explicitly rejected to keep the mental model "I'm looking at *these* matches, ranked by *these* stats." Users who need a different scope open a second tab.
- **Uniform grid, generic heading.** Every stat — including the anchor — renders as an equal card in a grid (the `event-pick-stat-grid` pattern). The page H1 is generic ("Leaderboards"); each card's H4 carries its stat label. The anchor has no visual distinction; re-anchoring is therefore invisible.
- **Card cap of 8.** Each stat is its own `api.statsTop()` call; capping bounds fan-out and keeps the page legible.
- **Bogus stat keys are silently dropped** from the URL on load. No error state for unknown keys.
- **Per-card ✕** removes a card; hidden on the last remaining card.

## Why this shape (and not the alternatives)

- *Hero + grid* was considered and rejected: it would make removing the anchor feel jarring (a card jumps to hero size) and bias the page toward "this is about the anchor stat" when it's really a comparative dashboard.
- *Per-card filters/presentation* was rejected: every card grows a control strip, the global filter row becomes misleading, and the page drifts into "dashboard builder" territory we don't want to own.
- *Hidden vs. disabled ✕ on the last card*: hidden, so the invariant ("at least one stat") is communicated by absence rather than a dead control.

## Consequences

- Existing `/stats/:statKey` bookmarks continue to work unchanged.
- Sharing a multi-stat view requires the query param; without it the URL collapses to single-stat.
- The StatPage now fans out N API calls per filter change (one per card, capped at 8). Independent loading/error state per card matches the EventPage "Pick a Stat" pattern.
