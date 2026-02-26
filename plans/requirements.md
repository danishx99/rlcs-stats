# RLCS Stats — Product Requirements

## Status
- This document is the single source of truth for product requirements and current behavior.
- Status legend:
  - `✅` implemented
  - `[ ]` not yet implemented

## Product Scope

### Terminology
- ✅ Use `Event` consistently in product/UI/data flows (no `Regional` labels in user-facing UI).

### Global Search
- ✅ Primary search supports: **Players**, **Teams**, **Stats**, **Events**
- ✅ Search results use consistent left-media/right-text row layout

## Core Pages

### Home (Landing)
- ✅ Current RLCS standings shown by default
- ✅ Season selector to view past standings
- ✅ Link/button to **Top Performing Teams & Players**
- ✅ Link/button to **Head-to-Head** compare tool
- ✅ Fast Insights panel with prebuilt top-query cards
- ✅ Fast Insights queries run across **all seasons** (not season-filtered)
- ✅ Fast Insights expanded rows show metric-specific context details
- ✅ Featured players section shows **6** players
- ✅ Featured player cards are clickable and open player profiles
- ✅ Secondary player-focused search bar for profile lookup

### Stats / Leaderboards
- ✅ Dedicated leaderboard page
- ✅ Supports selecting one or more stats
- ✅ Shows top 10 performers for chosen stat(s)
- ✅ Supports both player and team leaderboards
- ✅ Supports season / split / event filters
- ✅ Stat page display mode rules:
  - Player leaderboard rows: show player photo only (no team text/logo inline)
  - Team leaderboard rows: show team logo only

### Compare
- ✅ Compare supports up to **6** players/teams across one or more stats
- ✅ Compare add-search dropdown uses global-search style rows (image left, text right)
- ✅ Head-to-head stat cards (player compare view) do **not** show org/team name or team logo inline
- ✅ Head-to-head series table does **not** show team logos
- ✅ Improve head-to-head series Team A/Team B team-logo UI treatment (defer polish for later pass)

### Team / Roster Page
- ✅ Team logo and team name in header
- ✅ Current roster shown under team header
- ✅ Team info includes seasons competed, best result, debut season
- ✅ Player photos removed from roster starters/alternates list (team-focused layout)
- [ ] When navigating from a player profile to a team page (via the Teams list), auto-select the season where that player was on that team

### Player Profile Page
- ✅ Player image and player name in header
- ✅ Existing profile data retained (country, age, aliases, debut, key stats, career breakdown)
- ✅ Results history shows placement (for example: `3rd-4th`, `1st`) instead of round
- ✅ Results history retains opponent and score columns
- ✅ Results history ordered most recent first
- ✅ Opponent team logos shown in results table
- ✅ Fix top 8–16 placement labels not displaying correctly on player profile page

### Event Page
- ✅ Event name in header
- ✅ Event date range in header
- ✅ Top 8 placements for the event
- ✅ Event placements correctly handle bracket-reset grand finals labels (`GF 1` / `GF 2`) for Top 1/2/3-4/5-8 ordering
- ✅ Event top leaderboards (rating/goals/demos/saves/assists)
- ✅ Event leaderboard rows show larger player photo with top-focused crop
- ✅ Event leaderboard rows do **not** show team name or team logo inline

## Cross-App Presentation Rules
- ✅ Show player photos where player identity is primary (search/player lists/cards)
- ✅ Show org/team logos where team identity is primary
- ✅ Player photo crop should default to top-focused framing (avoid center torso crop)
- ✅ Explicit exceptions:
  - Compare head-to-head stat rows: no team/org identity
  - Event leaderboard rows: no team/org identity
  - Roster player list: no player photos

## Feedback Collection
- ✅ Persistent floating feedback button across pages
- ✅ Submits via `POST /api/feedback`

## Data Integrity & Ingestion
- ✅ Full data reload approach accepted for `Event` migration (no legacy backfill requirement for production)
- [ ] Zero-out known series completeness anomalies in source data before final production publish
- ✅ Fix incorrect placement calculations on player profile page (event placement and best result are currently wrong)
- ✅ Fix event page result placements (e.g. `/events/Regional%20Event%201?season=2021-22&split=Fall` shows incorrect placements)

## V0.1 Remaining Requirements

### Visual & UX
- [ ] Make overall UI more compact
- ✅ Add better placeholder icons for missing team logos and player photos
- [ ] Redesign the Team page UI
- [ ] Improve general UX across the app

### Data & Content
- [ ] Add 1v1 and Majors data to the database
- [ ] Ensure player aliases are listed (new column needed)

### Home Additions
- ✅ Rotating featured players from common stats (rating, goals, saves, demos, shots, assists)
- ✅ Add prebuilt query cards:
  - Highest in-game score
  - Most goals in a series
  - Most demos in a season
  - Longest overtimes
  - Most RLCS games played
  - Most goals in a single game
- ✅ Fast Insights detail formatting rules:
  - Highest in-game score, Most goals in a series, Longest overtimes, Most goals in a single game:
    show `season / split / event` and matchup teams on a separate line in expanded rows
  - Most demos in a season: show season only in expanded rows
  - Most RLCS games played: show first event in expanded rows
- ✅ Fast Insights expanded rows do not render player photos
- ✅ Add acknowledgements section at the bottom of the page
- ✅ Increase visual contrast for the Queries component on the home page

### Player Profile Improvements
- ✅ Show current team with clickable link
- ✅ Results view should support season-specific and all-time mode
- ✅ Player results and best result placement now use event-team placement logic (aligned with Event page placements)

### Admin
- [ ] Admin option to update player/team info

### Infrastructure
- ✅ Universal linking across app content:
  - Any displayed team name should link to that team/roster page
  - Any displayed player name should link to that player profile page
  - Exception: removal chips/buttons can keep link disabled to preserve button click behavior
