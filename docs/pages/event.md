# Event Page

**Route:** `/events/:eventId`
**Source:** `web/src/pages/EventPage.tsx`

Displays details for a specific RLCS event including placements, bracket, and player leaderboards.

**Composed of:** Top Bar (Event Search + Navigation Filters), Event Header, LAN Event Notice, Top Teams / Placements, Bracket, Core Leaderboards, Pick a Stat

## URL Parameters

- `:eventId` — the event identifier (URL-encoded).

## Sections

### 1. Top Bar (Search + Navigation Filters)

**Event search:**
- Debounced (500ms) search input querying `api.search()` for events only.
- Results show event name and season/split, clicking navigates to that event.

**Navigation filters (cascading):**
- Season, Split, and Event dropdowns populated from `api.meta()`.
- Filters are pre-filled from the current event's metadata.
- Event dropdown uses `sortEventsLanLast()` to order options with LAN events at the bottom.

### 2. Event Header

Displays event name, season/split breadcrumb, and date range (formatted from `minDate`/`maxDate`).

### 3. LAN Event Notice

If the event is international with tier `major` or `worlds`, a notice panel is shown instead of the standard view, explaining that only SSA-involved match slices are available.

### 4. Top Teams / Placements

A panel showing team placements in the event.

- Default view: top 8 teams. Toggle button to show all placements.
- Teams are grouped by placement range (e.g. "1st", "3rd-4th") with group headers.
- For 1v1 events, player names with photos are shown instead of team logos (via `PlayerNameWithPhoto`).
- For team events, `TeamNameWithLogo` is used.

### 5. Bracket

A panel showing the tournament bracket:

- Displays a bracket image via `proxyImageUrl()` if available.
- Links to the Liquipedia page if a `liquipediaUrl` is provided.
- Falls back to "No bracket resources" message.

### 6. Core Leaderboards

A grid of five hardcoded leaderboard panels, each rendered with the `Leaderboard` component:

| Key | Title |
|-----|-------|
| `rating` | Top 10 Players (Rating) |
| `goals` | Top Scorers (Goals) |
| `demos` | Top Executioners (Demos) |
| `saves` | Top Saviours (Saves) |
| `assists` | Top Playmakers |

Data is returned from the event detail endpoint as pre-computed leaderboards.

### 7. Pick a Stat

Allows users to add custom leaderboards beyond the core five.

- **StatPicker** component opens a category-based dropdown for selecting stats.
- **Suggested stats** are shown as quick-toggle checkboxes: shots, score, avg_speed, on_ground, in_air.
- Each selected stat triggers a separate `api.statsTop()` call scoped to the current event.
- Results are displayed in a grid of `Leaderboard` cards.

## Data Sources

| Data | API Call |
|------|----------|
| Event detail + teams + bracket + leaderboards | `api.eventDetail(eventId, { teamsLimit })` |
| Navigation filter options | `api.meta(params)` |
| Stat categories | `api.metaColumns()` |
| Extra stat leaderboards | `api.statsTop()` per selected stat |
| Event search | `api.search()` |

## Components Used

- `Leaderboard` — renders a ranked list of players/teams with stat values.
- `StatPicker` — category-based stat selection dropdown.
- `TeamNameWithLogo` — inline team name with logo.
- `PlayerNameWithPhoto` — inline player name with photo (used for 1v1 events).
