# RLCS Stats — Product Requirements

## Global

### Search Bar
- ✅ Searchable across: **Players**, **Teams**, **Stats**, **Events**

---

## Landing Page (Home)

### Current RLCS Standings
- ✅ Default view shows current season standings
- ✅ Dropdown to select and view past seasons

### Top Performing Teams & Players
- ✅ Button/link that navigates to a dedicated page (see below)

### Head to Head
- ✅ Button/link to the compare tool
- ✅ Compare up to **6 players** (or teams) on single or multiple stats

### Featured Players
- ✅ Display **6 featured players** (category-based, e.g. top scorer, most saves)
- ✅ Each card is clickable and navigates to that player's profile

### Player Profile Search
- ✅ Secondary search bar specifically for finding and viewing player profiles

---

## Top Performing Teams & Players Page

- ✅ Dedicated page for viewing leaderboards
- ✅ User can select **any stat** (or multiple stats) to view the **top 10** performers
- ✅ Supports both **player** and **team** leaderboards
- ✅ Filterable by season / split / event

---

## Team Page (e.g. searching "Pioneers")

### Header
-  Team logo & team name

### Roster
-  Current roster listed under the team name

### Info
-  Seasons competed in (e.g. "SSA RLCS")
-  Best result
-  Debut season

---

## Player Profile Page

### Header
- ✅ Player picture & player name

### Stats & Info
- ✅ All existing profile content (country, age, aliases, debut, key stats, career breakdown, etc.)

### Results History
- ✅ List of tournament placements, e.g.:
  - "3rd–4th — 2024 Open 5"
  - "1st — 2025 Boston Major"
- ✅ Ordered chronologically (most recent first)

---

## Event Page (e.g. "Boston Major", "Open 1")

### Header
- ✅ Event name (e.g. "Boston Major — Open 1")
- ✅ Event dates (e.g. "27–29 November 2025")

### Placements
- ✅ **Top 8** teams for that event/regional

### Stat Leaderboards
- Top 10 lists for the event:
  - ✅ **Top Players** (player rating)
  - ✅ **Top Scorers** (goals)
  - ✅ **Top Executioners** (demos)
  - ✅ **Top Saviours** (saves)
  - ✅ **Top Assists** (assists)

---

## Floating Feedback Button

- ✅ Persistent floating button on all pages
- ✅ For the initial release only — used to collect feedback and ideas from the first group of testers
- ✅ Submits feedback via `POST /api/feedback`
