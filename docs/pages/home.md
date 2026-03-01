# Home Page

**Route:** `/`
**Source:** `web/src/pages/HomePage.tsx`

The landing page and main dashboard for the application.

**Composed of:** Hero, Global Search Bar, Navigation Row (Quick-nav Cards + Standings), Insights Grid (Fast Insights + Featured Profiles + Player Search), Acknowledgements

## Props

Receives from `App.tsx`:

- `latestSeason` — the most recent season string, derived from `useMeta` and sorted numerically.
- `featuredOptions` — list of `StatOption` objects for the featured leaderboard section.

## Sections

### 1. Hero

A branded header with the title "RLCS SSA" and subtitle "Sub-Saharan Africa Championship Statistics".

### 2. Global Search Bar

A debounced (500ms) search input that queries `api.search()` across all game modes. Returns results grouped into four categories:

- **Players** — avatar, handle, real name. Navigates to `/players/:id`.
- **Teams** — logo, name, starters list. Navigates to `/rosters/:id`.
- **Stats** — stat name. Navigates to `/stats/:id`.
- **Events** — event name with season/split. Navigates to `/events/:id`.

Clicking outside the search area clears results.

### 3. Navigation Row

Two-column layout:

**Left — Quick-nav cards:**
- "Head to Head" — navigates to `/compare`.
- "Top Performing Teams & Players" — navigates to `/stats/score` with default 3s/regional/none filters.

**Right — Standings panel:**
- Season standings fetched from `api.standings()`.
- Season selector dropdown populated from the standings response.
- Top 8 teams shown with rank, logo, name, horizontal bar (proportional to points), and points total.
- Each row navigates to the team's roster page on click.

### 4. Insights Grid

Two-panel grid:

**Left — Fast Insights (Top Queries):**
- Loaded from `api.insights()` with a limit of 6 categories.
- Each tile shows the query title and the top result (label + value).
- Expandable to show the top 6 rows with rank, label, context, and value.

**Right — Featured Profiles:**
- A randomly selected metric from `["rating", "goals", "saves", "demos", "shots", "assists"]`.
- Fetches top 6 players via `api.statsTop()` for the latest season (3s/regional/none).
- Cards show player photo, handle, team (with logo via `TeamNameWithLogo`), and formatted stat value.
- Clicking a card navigates to the player's profile.

Below the featured cards is a **Player Search** input with its own debounced search, returning player-only results.

### 5. Acknowledgements

Static credits section listing Ballchasing.com, CARL, Liquipedia, Borkey, and D-Money.

## Data Sources

| Data | API Call |
|------|----------|
| Featured leaderboard | `api.statsTop()` |
| Standings | `api.standings()` |
| Top queries | `api.insights()` |
| Search | `api.search()` |

## Key Constants

- `HOME_TRACK` — `{ gameMode: "3s", scope: "regional", tier: "none" }`, the default filter context for the home page.
- `SEARCH_DEBOUNCE_MS` — 500ms debounce on both search inputs.
