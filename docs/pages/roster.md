# Roster Page

**Route:** `/rosters/:rosterId`
**Source:** `web/src/pages/RosterPage.tsx`

Displays a team/roster profile with metadata, season-by-season roster iterations, and team history.

**Composed of:** Profile Header, Roster Iterations by Season, Competed in Seasons, Also Competed Under

## URL Parameters

- `:rosterId` — the roster identifier (typically an org-based ID).

## Sections

### 1. Profile Header

A card showing the team's identity:

- **Logo** — proxied image, falls back to `DEFAULT_TEAM_LOGO`.
- **Team name** and subtitle showing current roster starters (formatted via `formatRosterStarters()`).
- **Metadata grid:** RLCS debut, best result, series played, games played.
- **Social links:** Twitter, YouTube, Twitch, TikTok (normalized via `normalizeSocialLink()`).

### 2. Roster Iterations by Season

Shows how the roster composition changed over time.

**Controls:**
- **Season selector** — dropdown populated from `seasonsCompeted` or `seasonRosters`. Defaults to the API-provided `defaultSeason`.

For each iteration within the selected season:

- **Header** — team label used during that iteration + series count.
- **Starters** — tag list of player handles, each clickable to navigate to the player's profile.
- **Alternates** — tag list of substitute players with appearance counts (e.g. "Player (3)"). Only shown if alternates exist.
- **Also Competed Under** — other team names used by this roster iteration. Each is a button navigating to that team's roster page. Deduplicated against the primary team name.

### 3. Competed in Seasons

A tag list of all seasons the team has participated in.

### 4. Also Competed Under (Org-level)

Org-wide list of other team names, deduplicated against the primary team name. Each navigates to the corresponding roster page.

## Data Sources

| Data | API Call |
|------|----------|
| Roster profile | `api.rosterProfile(rosterId, params)` |

Default filter context: `mode=3s, scope=regional, tier=none` (defined in `ROSTER_TRACK`).

## Components Used

- `TeamNameWithLogo` — inline team name with logo.
