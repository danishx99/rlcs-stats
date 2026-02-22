# RLCS Stats — Product Requirements

## Document Status
- This file consolidates requirements added over time into one coherent source.
- Status legend:
  - `✅` implemented
  - `[ ]` not yet implemented

## Product Scope

### Global
- ✅ Primary search supports: **Players**, **Teams**, **Stats**, **Events**

### Core Pages

#### Home (Landing Page)
- ✅ Current RLCS standings shown by default
- ✅ Season selector to view past standings
- ✅ Link/button to **Top Performing Teams & Players**
- ✅ Link/button to **Head to Head** compare tool
- ✅ Compare supports up to **6** players/teams across one or more stats
- ✅ Featured players section shows **6** players
- ✅ Featured player cards are clickable and open player profiles
- ✅ Secondary player-focused search bar for profile lookup

#### Top Performing Teams & Players
- ✅ Dedicated leaderboard page
- ✅ Supports selecting one or more stats
- ✅ Shows top 10 performers for chosen stat(s)
- ✅ Supports both player and team leaderboards
- ✅ Supports season / split / event filters

#### Team Page (example: "Pioneers")
- ✅ Team logo and team name in header
- ✅ Current roster shown under team header
- ✅ Team info:
  - Seasons competed in (example: SSA RLCS)
  - Best result
  - Debut season

#### Player Profile Page
- ✅ Player image and player name in header
- ✅ Existing profile data retained (country, age, aliases, debut, key stats, career breakdown, etc.)
- ✅ Results history shows tournament placements (for example: `3rd–4th — 2024 Open 5`, `1st — 2025 Boston Major`)
- ✅ Results history ordered most recent first

#### Event Page (examples: "Boston Major", "Open 1")
- ✅ Event name in header
- ✅ Event date range in header
- ✅ Top 8 placements for the event/regional
- ✅ Event top-10 leaderboards:
  - Top Players (rating)
  - Top Scorers (goals)
  - Top Executioners (demos)
  - Top Saviours (saves)
  - Top Assists (assists)

### Feedback Collection
- ✅ Persistent floating feedback button across pages
- ✅ Intended for initial release tester feedback collection
- ✅ Submits via `POST /api/feedback`

## V0.1 Remaining Requirements

### Visual & UX
- [ ] Make overall UI more compact

### Data & Content
- [ ] Add 1v1 and Majors data to the database
- [ ] Ensure player aliases are listed (new column needed)

### Home Page Additions
- [ ] Rotating featured players
  - Source from common stats (goals, saves, demos, shots, assists)
  - Show top 6, rotating weekly or randomly
- [ ] Add prebuilt query cards:
  - Highest in-game score
  - Most goals in a series
  - Most demos in a season
  - Longest overtimes
  - Most RLCS games played
  - Most goals in a single game
- [ ] Add acknowledgements section at bottom of page

### Player Profile Improvements
- [ ] Show current team with clickable link
- [ ] Results view should support season-specific or all-time mode

### Presentation Consistency Across App
- [ ] Show player pictures wherever players are listed
- [ ] Show org logos wherever teams are listed

### Admin
- [ ] Admin option to update player/team info

### Infrastructure
- [ ] Universal linking
