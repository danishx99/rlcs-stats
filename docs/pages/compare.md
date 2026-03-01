# Compare Page

**Route:** `/compare`
**Source:** `web/src/pages/ComparePage.tsx`

Head-to-head comparison page for players or teams across selected stats.

**Composed of:** Selection Panel (Search + Chips), Metrics Panel (Stat Toggles + StatPicker), Stats View / Comparison Results (Filters + ComparePanel)

## Sections

### 1. Selection Panel

**Search input:**
- Debounced (500ms) search via `api.search()` returning both players and rosters.
- Once the first entity is added, results are locked to the same type (players-only or teams-only).
- Each result shows avatar/logo, name, subtitle (real name for players, starters for teams), and type badge.
- Already-added entities are visually marked and non-clickable.

**Selection chips:**
- Shows all selected entities as removable chips with photos/logos.
- "Clear All" button to reset the selection.
- Prompt text when empty: "Search and add 2-6 players or teams to compare."

### 2. Metrics Panel

Controls which stats appear in the comparison.

**Default stats:** goals, assists, saves, demos.

**Stat toggles:**
- Checkbox list of all available stat options from `api.meta()` (excludes `series_played`).
- Additional stats can be added via the `StatPicker` dropdown (category-based selection from `api.metaColumns()`).
- Extra stats added via the picker persist even if unchecked, allowing easy re-toggling.

### 3. Stats View / Comparison Results

The main comparison output, rendered by the `ComparePanel` component.

**Filter controls:**
- **Include LAN Events** — checkbox (3s only).
- **Game mode** — 1s, 2s, 3s dropdown.
- **Season** — dropdown (resets split and event on change).
- **Split** — dropdown (disabled until season is selected).
- **Event** — dropdown (disabled until season and split are selected). LAN events sorted to bottom.

**Behavior:**
- The `ComparePanel` receives the full selection, filters, stat options, and selected metrics.
- Heading changes to "Head-to-Head Comparison" when 2+ entities are selected, otherwise shows "Player/Team Statistics".
- Selecting an international event auto-enables LAN inclusion.

## Filter State

Filters are stored in component state (not URL params), initialized to:
```
{ mode: "3s", scope: "regional", tier: "none", season: "", split: "", event: "" }
```

The `useMeta` hook provides cascading filter options based on the current filter state.

## Data Sources

| Data | API Call |
|------|----------|
| Search results | `api.search(params)` |
| Filter options | `useMeta(filters)` via `api.meta()` |
| Stat categories | `api.metaColumns()` |
| Comparison data | Handled by `ComparePanel` component |

## Components Used

- `ComparePanel` — renders the side-by-side stat comparison table/visualization.
- `StatPicker` — category-based stat selection dropdown.
- `TeamNameWithLogo` — inline team name with logo.
- `PlayerNameWithPhoto` — inline player name with photo.
