# Customizable Career Spotlight

## Problem Statement

When viewing a player profile, the Career Spotlight section always shows the same four stats: goals, assists, saves, and demos. Users who care about other dimensions of play — shots, MVPs, boost usage, speed, time in the offensive half, demos taken, save percentage, and so on — cannot pin those stats to the spotlight. They must instead navigate to the Stat page or scroll through the season table to read off the numbers, losing the at-a-glance "career headline" framing that the spotlight provides.

Other pages in the app (Stat, Event, Compare) already let users click stats from a catalog to control what is shown. The player profile is the conspicuous exception.

## Solution

Let users add stats to a player's Career Spotlight using the same StatPicker pattern used elsewhere in the app. The existing four stats remain pinned as defaults. Users can add up to eight additional stats from the full StatPicker catalog. Each added stat appears as a tile alongside the defaults, showing the same shape of information — total, per-game average, and career-wide rank — with display tuned to the stat's type (counting stats show a total, rate and percentage stats show only an average).

The user's selection is encoded in the URL so links to a player profile can include a custom spotlight, and so refreshing the page does not lose the selection.

## User Stories

1. As a Rocket League fan browsing a player profile, I want to see the same four headline stats as before by default, so that my existing experience does not change unless I choose to customize it.
2. As a fan, I want to click an "Add Stat" button in the Career Spotlight header, so that I can pin extra stats to the section.
3. As a fan opening the picker, I want to see the full stat catalog grouped by category, so that I can find what I am looking for the same way I do on other pages.
4. As a fan, I want to search within the picker, so that I can quickly find a specific stat without scrolling.
5. As a fan, I want my newly added stats to appear in the Career Spotlight after the four defaults, in the order I added them, so that I control the layout implicitly.
6. As a fan, I want each custom tile to show the stat's career total and per-game average where applicable, so that the information matches what the existing tiles show.
7. As a fan, I want each custom tile to show the player's overall rank for that stat, so that I can see how the player compares to everyone else.
8. As a fan adding a rate stat such as average speed, or a percentage stat such as boost stolen percent, I want the tile to show only the average and skip the meaningless "sum" line, so that I am not shown nonsense numbers.
9. As a fan, I want to remove a custom stat by clicking it again in the picker, so that the picker behaves consistently with other pages.
10. As a fan, I want to hover a custom tile and click an inline × to remove it, so that I can drop a single stat without opening the picker.
11. As a fan, I want the four default tiles to be unremovable and to have no × control, so that the spotlight always has its anchor stats.
12. As a fan, I want to be limited to eight custom stats (twelve total in the spotlight), so that the section stays visually balanced and does not become a dumping ground.
13. As a fan reaching the cap, I want further options in the picker to gray out, so that I understand why I cannot add more and which selections I would need to drop first.
14. As a fan, I want my spotlight selection to be reflected in the URL, so that I can share a link that includes my custom view.
15. As a fan opening a shared link with a spotlight query string, I want the listed stats to be applied automatically, so that the link recreates what the sender saw.
16. As a fan, I want refreshing the page to preserve my spotlight selection, so that I do not have to re-add my stats.
17. As a fan, I want my selection to be scoped to the current player profile only, so that opening a different player shows their default spotlight and does not surprise me with my previous choices.
18. As a fan, I want the spotlight to remain career-wide regardless of any season/event filters I apply elsewhere on the page, so that totals and ranks stay meaningful and consistent with the section's name.
19. As a fan on a narrow viewport, I want extra tiles to wrap onto additional rows, so that the section stays readable on mobile.
20. As a fan, I want the picker trigger and dropdown to look and behave exactly like the picker on the Stat, Event, and Compare pages, so that I do not have to learn a new interaction.
21. As a developer maintaining the player profile endpoint, I want the API to accept a list of spotlight stat keys and return their totals, averages, and ranks alongside the existing payload, so that the front end can render the section in a single request without a separate loading state per tile.

## Implementation Decisions

### Modules

- **Spotlight stat resolver (server).** Given a player ID and a list of requested stat keys, returns an array of `{ key, total, avg, rankTotal, rankAvg }`. Encapsulates the SQL that today hardcodes goals/assists/saves/demos: builds rank window functions dynamically from the requested keys, validates keys against the catalog, dedupes against the four defaults (so requesting a default key is a no-op). The resolver is the single source of truth for "what does the spotlight show for one stat" and is the only place new spotlight behavior should be added.
- **Player profile route (modified).** Reads `spotlight` from the query string, parses it as a comma-separated list, caps at 8 keys, calls the resolver, and merges results into the existing `totals`, `averages`, and `ranks` blocks of the player profile response.
- **Stat format → display mode mapping (web).** A small pure function from `StatOption.format` (`int | float | pct`) to a display mode (`"count"` for `int`, `"rate"` for `float` and `pct`). Drives whether a tile shows total+avg or just avg.
- **Career Spotlight section (modified, web).** Reads `spotlight` from the URL, renders the four default tiles plus the custom tiles in selection order, owns the StatPicker trigger in the section header, writes URL state on add/remove, applies the 8-custom cap via the picker's existing `disabledKeys` prop.
- **Spotlight tile (new, web).** Small presentational component that renders one tile given its label, totals, averages, ranks, and a `removable` flag with `onRemove`. Display mode (count vs rate) decides which numbers show.
- **API client (modified, web).** `api.playerProfile` gains an optional `spotlight` array; the client serializes it as a comma-separated query param.

### API contract

- `GET /api/players/{id}?spotlight=key1,key2,...` (param optional).
- Response shape unchanged in structure: `totals`, `averages`, `ranks.total`, `ranks.avg` continue to be objects keyed by stat name. Requested spotlight keys are added as additional keys inside each of those objects (alongside the existing `goals`, `assists`, `saves`, `demos`). Defaults always present.
- Invalid keys (not in the stat catalog) are silently dropped; keys that duplicate a default are dropped.
- Server caps the list at 8 keys; extras are ignored.
- `ranks.total[key]` and `ranks.avg[key]` may be `null` if no rank can be computed (e.g., player has no games with non-null values for that stat); the tile handles `null` by omitting the rank line, matching today's behavior for the defaults.

### URL state

- Query param: `?spotlight=key1,key2,...`.
- Order in the URL equals render order of the custom tiles.
- Param is scoped per-player-profile-page. Navigating to a different player profile drops the param; no cross-player memory and no localStorage.
- Adding, removing, or reordering stats updates the URL without a full page reload (same mechanism the Stat/Event/Compare pages already use).

### Display rules

- Tile selection from `StatOption.format`:
  - `int` → big number = career total, secondary line = per-game average. Matches today's defaults.
  - `float` or `pct` → big number = per-game average; total line is omitted because summing rates is meaningless.
- Rank line: `Nth overall` if `rankTotal` is present (for count stats) or `rankAvg` is present (for rate stats); omitted otherwise. The four defaults continue to use `rankTotal` exclusively as they do today.
- Numbers are formatted using the same helpers already in use for the four defaults (`toLocaleString("en-US")` with `"en-US"` thousands separators for integers, `.toFixed(1)` for averages, plus `%` suffix when `format === "pct"`).

### Interaction details

- "+ Add Stat" button lives in the Career Spotlight section header, on the right opposite the title. Same `StatPicker` component used on other pages, configured for multi-select with `dropdown` mode.
- The picker's `selected` list reflects only the *custom* additions, not the four defaults. (The four defaults are not togglable.)
- When the user has eight custom stats selected, all other stats in the picker are passed via `disabledKeys` so they appear grayed out with the existing "Stat selection cap reached" tooltip.
- Custom tiles show a small × on hover (top-right corner). Clicking it removes that stat from the selection and from the URL.
- Default tiles never show a ×.
- Tile grid uses the existing CSS grid layout; extra tiles wrap naturally.

### Filter scope

- The Career Spotlight section ignores all page filters (mode, scope, tier, season, split, event, arena). It always reflects career-wide totals, averages, and ranks. Other sections of the player profile continue to respect filters.

## Testing Decisions

Skipped at user's request.

## Out of Scope

- localStorage persistence or any cross-player memory of spotlight selections.
- Filter-aware spotlight (e.g., "Worlds-only career spotlight"). The Results and Season sections already cover filtered slices.
- Drag-to-reorder of custom tiles. Selection order is the only ordering mechanism.
- A curated subset of "spotlight-friendly" stats; the full StatPicker catalog is exposed.
- Changes to the four defaults (still goals, assists, saves, demos).
- Changes to ranks for the four defaults; their SQL stays as-is.
- Mobile-specific layout (horizontal scroller, show-more toggle); natural CSS wrapping is sufficient.
- Refactoring the existing `playerProfile.totals.goals` shape into a generic `{ stats: { [key]: {...} } }` map; defaults stay where they are and new keys are appended into the same objects.
- Applying the same customization pattern to other sections of the player profile (Results, Season table). Only Career Spotlight is in scope.

## Further Notes

- The four-default + eight-custom cap was chosen to keep the section visually balanced (up to three rows of four on desktop). The cap can be raised later by changing a single constant; both the server cap and the front-end `disabledKeys` derivation should be updated together.
- The resolver should reuse the same rank window pattern that the existing player profile SQL uses for the four defaults, just parameterized over the requested keys. This keeps the rank semantics consistent: total ranks compare career sums across all players; avg ranks compare per-game averages across all players.
- The `format` field on `StatOption` already exists in the meta payload; no schema change is needed to drive the count/rate tile distinction.
