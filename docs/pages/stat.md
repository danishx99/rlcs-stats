# Stat Page

**Route:** `/stats/:statKey`
**Source:** `web/src/pages/StatPage.tsx`

A multi-leaderboard page. The path stat is the "anchor"; additional stats can be added as side-by-side cards. All cards share the same filters and presentation controls, so the page reads as a comparative view over a single match scope.

**Composed of:** Header, Controls (Entity Type + Aggregation Mode + Sort + StatPicker + Filters + Share), Card Grid (one Leaderboard per selected stat).

See [ADR 0001](../adr/0001-stat-page-multi-stat-grid.md) for the rationale behind the multi-stat design.

## URL Parameters

- `:statKey` — the anchor stat (always rendered; first card in the grid).

## Query Parameters

All state is stored in the URL via `useSearchParams`, making views shareable:

| Param | Default | Values |
|-------|---------|--------|
| `stats` | (empty) | CSV of extra stat keys, e.g. `goals,demos`. Anchor is NOT repeated here. Dropped from URL when empty. Unknown keys are silently filtered on load. Capped at 7 extras (8 total cards). |
| `type` | `player` | `player`, `team` |
| `mode` | `avg` | `avg` (per game), `total` |
| `sort` | `desc` | `desc` (highest first), `asc` (lowest first) |
| `limit` | `10` | `10` or `50` (See All) |
| `season` | (all) | any season string |
| `split` | (all) | any split string |
| `event` | (all) | any event name |
| `gameMode` | `3s` | `1s`, `2s`, `3s` |
| `includeLans` | `0` | `0`, `1` |

## Sections

### 1. Header

H1 reads "Leaderboards" (generic — no longer tied to a single stat). Subheading summarises the active scope: e.g. `Per Game · S25 Spring · 3s · Regional only`.

### 2. Controls

**Toggle tabs:**
- **Entity type** — Players vs Teams (Teams disabled for 1v1 mode). Applies to all cards.
- **Aggregation mode** — Per Game vs Total. Applies to all cards.

**Sort toggle** — icon button to flip between descending and ascending. Applies to all cards.

**StatPicker** — category-based multi-select dropdown. Toggles add/remove stats from the URL. The currently-selected anchor + extras are all shown as selected. Removing the anchor re-anchors to the next stat in the list. Removing the last remaining stat is prevented.

**See All** — toggles `limit` between 10 and 50. Applies to every card.

**Share** — copies the current URL (or uses the Web Share API where available). Same affordance as EventPage.

**Filters row:**
- **Include LAN Events** — checkbox (3s only). Auto-enabled when a LAN event is selected.
- **Game mode** — 1s, 2s, 3s dropdown.
- **Season** — dropdown, clears split and event on change.
- **Split** — dropdown (disabled until season is selected), clears event on change.
- **Event** — dropdown (disabled until season is selected). LAN events are sorted to the bottom via `sortEventsLanLast()`.

### 3. Card Grid

A uniform grid of `Leaderboard` cards — one per selected stat (anchor + extras). All cards are visually equal; the anchor has no special treatment.

- Each card renders with `showTeamLogos={false}`, `showTeams={false}`, `playerImageSize="large"` (matching EventPage's `event-pick-stat-grid`).
- Each card has its own H4 (stat label) and a ✕ button to remove itself. The ✕ is **hidden on the last remaining card** to enforce the ≥1 invariant.
- Cards have independent loading/error/empty state. A filter change re-fetches all cards in parallel via `Promise.allSettled`.

## Filter Behavior

- Filters cascade: changing season resets split and event; changing split resets event; changing game mode resets all filters.
- When `gameMode=3s` and `includeLans` is off, `scope=regional` and `tier=none` are applied to exclude international events.
- Selecting a LAN event automatically enables `includeLans`.

## Data Sources

| Data | API Call |
|------|----------|
| Filter options | `api.meta(params)` |
| Stat categories | `api.metaColumns()` |
| Per-card leaderboards | `api.statsTop(params)` — one call per selected stat |

## Components Used

- `Leaderboard` — ranked list with stat values, player photos, and team logos.
- `StatPicker` — category-based stat selection (multi-select dropdown).
