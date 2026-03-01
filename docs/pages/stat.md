# Stat Page

**Route:** `/stats/:statKey`
**Source:** `web/src/pages/StatPage.tsx`

A leaderboard page for any single stat, with extensive filtering and customization controls.

**Composed of:** Header, Controls (Entity Type + Aggregation Mode + Sort + StatPicker + Filters), Leaderboard

## URL Parameters

- `:statKey` — the stat column key (e.g. `score`, `goals`, `rating`).

## Query Parameters

All filters are stored in the URL via `useSearchParams`, making leaderboard views shareable:

| Param | Default | Values |
|-------|---------|--------|
| `type` | `player` | `player`, `team` |
| `mode` | `avg` | `avg` (per game), `total` |
| `sort` | `desc` | `desc` (highest first), `asc` (lowest first) |
| `season` | (all) | any season string |
| `split` | (all) | any split string |
| `event` | (all) | any event name |
| `gameMode` | `3s` | `1s`, `2s`, `3s` |
| `includeLans` | `0` | `0`, `1` |

## Sections

### 1. Header

Displays the stat label (resolved from stat categories), subtitle showing "Top/Lowest 10 Players/Teams - Per Game/Total".

### 2. Controls

**Toggle tabs:**
- **Entity type** — Players vs Teams (Teams disabled for 1v1 mode).
- **Aggregation mode** — Per Game vs Total.

**Sort toggle** — icon button to flip between descending and ascending order.

**StatPicker** — a dropdown to switch to a different stat. Opens the category-based picker in single-select mode.

**Filters row:**
- **Include LAN Events** — checkbox (3s only). Auto-enabled when a LAN event is selected.
- **Game mode** — 1s, 2s, 3s dropdown.
- **Season** — dropdown, clears split and event on change.
- **Split** — dropdown (disabled until season is selected), clears event on change.
- **Event** — dropdown (disabled until season is selected). LAN events are sorted to the bottom via `sortEventsLanLast()`.

### 3. Leaderboard

Rendered by the `Leaderboard` component. Shows top 10 entries with the selected stat value.

## Filter Behavior

- Filters cascade: changing season resets split and event; changing split resets event; changing game mode resets all filters.
- When `gameMode=3s` and `includeLans` is off, `scope=regional` and `tier=none` are applied to exclude international events.
- Selecting a LAN event automatically enables `includeLans`.

## Data Sources

| Data | API Call |
|------|----------|
| Filter options | `api.meta(params)` |
| Stat categories | `api.metaColumns()` |
| Leaderboard | `api.statsTop(params)` |

## Components Used

- `Leaderboard` — ranked list with stat values, player photos, and team logos.
- `StatPicker` — category-based stat selection (single-select, dropdown mode).
