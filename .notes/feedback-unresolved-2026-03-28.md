# Unresolved Feedback (fetched 2026-03-28)

---

## Tier 1 — Quick UI fixes (< 1 hour each)

### 1. #33 — Back button (Idea, 2026-03-24)
**Page:** `/events/...`
**Type:** UI only

A 'back' button would be useful. The 'back to dashboard' is good but not useful if you're looking at a player profile, or team or event and click a player to check something and want to go back to where you were before.

**Effort:** Trivial — add a browser-back button (`navigate(-1)`) alongside the existing "Back to Dashboard" button on player/roster/event pages.

### 2. #29 — Links not openable in new tab (Bug, 2026-03-21)
**Page:** `/rosters/org%3ARISING%20ESPORTS?season=2026`
**Type:** UI only

You can't open links in a new tab i.e. on this page I want to open the profile for each of the roster but they can't be opened up in new tabs.

**Effort:** Moderate but mechanical — 23+ onClick/navigate patterns across HomePage, RosterPage, PlayerPage, FeaturedPanel need converting to `<Link>` components. Pattern is consistent so it's repetitive not hard.

---

## Tier 2 — Small changes, infra already exists (few hours each)

### 3. #31 — Event leaderboards: add "total" option (Idea, 2026-03-22)
**Page:** `/events/...`
**Type:** UI + minor backend

Event stat performers should also have the "total" option as well as average.

**Effort:** The `metricExpression()` util already supports `mode: "total"`. Event route just hardcodes `"avg"`. Wire a `mode` query param through the event leaderboard endpoint + add a toggle in the UI.

### 4. #34 — "See all" on top performers (Idea, 2026-03-24)
**Page:** `/stats/score?...`
**Type:** UI + minor backend

Top performers shows top 10. Can there be an option to 'see all' to get the full list of performers for selected stat(s)?

**Effort:** API already accepts `limit` param (capped at 50). Add a "See all" link/button in the UI that either bumps the limit or navigates to a dedicated stat page. May want to raise the cap or add pagination for truly full lists.

### 5. #35 — Show avg+total side by side on leaderboards (Idea, 2026-03-24)
**Page:** `/stats/score?...`
**Type:** UI + minor backend

It would be helpful both avg and total to be shown. So if "total" number is selected the avg can be in brackets. Goals - 234 (1.2) or Goals - 1.2 (234)

**Effort:** Backend already supports both modes. Either run two queries or extend the SQL to return both columns. UI needs a secondary value display.

---

## Tier 3 — Medium features, some new SQL/UI (1–2 days each)

### 6. #36 — Player profile: career totals per season (Idea, 2026-03-25)
**Page:** `/players/SSA-P-10297`
**Type:** UI + backend

Player profile in addition to stat breakdowns for every season should have a total for each.

**Effort:** Profile SQL already returns `goals_total`, `assists_total`, etc. for career-wide stats. Need to add per-season totals to the season breakdown query + display them in the UI.

### 7. #26 — Player profile: all-time marquee stats (Idea, 2026-03-20)
**Page:** `/players/SSA-P-10226`
**Type:** UI + backend

All time stats in the major categories (goals, assists, saves etc) as well as total games played/won/lost. Current averages are great but for marquee stats those are great to showcase.

**Effort:** Career totals already exist in the profile query (`goals_total`, `assists_total`, etc.). Main work is designing a prominent "career totals" section in the player profile UI. Games won/lost needs a new SQL count.

### 8. #30 — Player profile: avg/total toggle + stat ranking (Idea, 2026-03-22)
**Page:** `/players/SSA-P-10281`
**Type:** UI + backend (new SQL)

Option to look at stats as either average or total, and select which stats to view. Also a ranking of that stat (i.e. 356 goals - 23rd overall).

**Effort:** Toggle is straightforward (data partially exists). The ranking feature needs a new query with `RANK() OVER (ORDER BY ...)` window functions — not hard SQL but a new endpoint or query variant.

### 9. #27 + #28 — Compact view / share button (Ideas, 2026-03-21)
**Pages:** `/stats/score?...`, `/events/...`
**Type:** UI only (+ share API)

Displays are too wide for screen grabs. Need a compact view or export. Event page stats layout is good — now need a share button.

**Effort:** Compact view is CSS work (max-width constraints, tighter layout). Share button needs `navigator.share()` or copy-to-clipboard with a shareable URL. Medium UI work.

---

## Tier 4 — Larger features (3+ days)

### 10. #32 — Stage/phase filter for events (Idea, 2026-03-22)
**Page:** `/events/...`
**Type:** UI + backend + data

Filter to get stats for stage "GSL/SWISS", "DAY 1", "PLAYOFFS" — stats for sections of a tournament.

**Effort:** Needs the event page to expose stage/round metadata as filter options. Requires a new meta query to get distinct stages per event, a new filter param in the event stats SQL, and filter UI. The data columns (`Stage`, `Round`) exist in the stats table so no schema changes needed.

### 11. #19 — Hover popups for players/teams (Idea, 2026-02-21)
**Page:** `/players/SSA-P-10039`
**Type:** UI + backend

Hover over a player and get a summary of their profile; hover over a team and get their roster.

**Effort:** Needs a lightweight summary endpoint (or reuse existing profile endpoint), a popover/tooltip component with debounced hover, and integration everywhere player/team names appear. Significant UI work + performance considerations (prefetch, caching).
