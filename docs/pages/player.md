# Player Page

**Route:** `/players/:uniqueId`
**Source:** `web/src/pages/PlayerPage.tsx`

Displays a player's profile, season-by-season performance, event results, and team history.

**Composed of:** Player Overview Card, Performance by Season, Results, Teams

## URL Parameters

- `:uniqueId` — the player's unique identifier from the `stats` table.

## Sections

### 1. Player Overview Card

A panel showing the player's identity and metadata:

- **Photo** — proxied via `proxyImageUrl()`, falls back to `DEFAULT_PLAYER_PHOTO`.
- **Handle** — primary display name.
- **Country** and **Current Team** (with logo via `TeamNameWithLogo`).
- **Details list:** real name, aliases (formatted via `formatAliases()`), birthday (with computed age), RLCS debut season, best result.
- **Social links:** Twitch and TikTok, normalized via `normalizeSocialLink()`.

### 2. Performance by Season

A table of season-level averages rendered by the `SeasonTable` component.

**Controls:**
- **Game mode selector** — dropdown for 1s, 2s, 3s.
- **Include LAN Events** — checkbox (only enabled for 3s mode). When unchecked, filters to `scope=regional, tier=none`.

Fetches data from `api.playerSeason()` with `mode=avg`.

### 3. Results

A table of the player's event results with columns: Event, Placement, Opponent, Score.

**Controls:**
- **View toggle** — "Season" (filtered to selected season) or "All-Time".
- **Season selector** — dropdown, only shown when in Season view mode. Seasons are listed in reverse chronological order.

**Row details:**
- Event name links to the event page via `buildEventPath()`.
- Placement is formatted from `placementStart`/`placementEnd` range (e.g. "3rd-4th"), with gold highlight for 1st place.
- LAN event results show placement as "—" since only partial SSA data is available.
- Opponent shown with team logo. Score shows win/loss game counts with color coding.
- Rows are styled with win/loss background classes.

### 4. Teams

A tag list of all teams the player has competed for. The first tag is highlighted as the current team. Each tag navigates to the roster page via `resolveTeamRosterId()`.

## Data Sources

| Data | API Call |
|------|----------|
| Profile | `api.playerProfile(uniqueId)` |
| Season stats | `api.playerSeason(uniqueId, params)` |
| Event results | `api.playerResults(uniqueId)` |

## Components Used

- `SeasonTable` — renders season-by-season stat rows.
- `TeamNameWithLogo` — inline team name with logo.
