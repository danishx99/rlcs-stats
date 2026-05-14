# Slice 2 — Web: render spotlight stats from URL param (read-only)

## Parent

`plans/customizable-career-spotlight.md`

## What to build

On the player profile page, read a `spotlight` query parameter from the URL (comma-separated stat keys), pass those keys into the player profile API call, and render an extra tile for each key in the Career Spotlight section, appearing after the four default tiles in the order the keys appear in the URL.

Each tile renders the stat's label, total, per-game average, and overall rank. The display mode is driven by the stat's `format` from the catalog:

- `int` → big number is the career total, secondary line is the per-game average (same as today's defaults).
- `float` or `pct` → big number is the per-game average; no total line.

Rank line shows `Nth overall` when a rank value is present; otherwise it is omitted. Percentage stats render their average with a `%` suffix; integers use `toLocaleString("en-US")`; floats use `.toFixed(1)`.

No picker UI yet — selection is URL-only. A user visiting `/players/{id}?spotlight=shots,boost_collected_total` sees those tiles. The Career Spotlight section continues to ignore page filters.

Extract a small Spotlight Tile component so the section's JSX is not a tangle of conditionals.

## Acceptance criteria

- [ ] Career Spotlight renders the four existing default tiles unchanged when no `spotlight` param is present.
- [ ] When `?spotlight=key1,key2` is present, two extra tiles appear after the defaults in that order.
- [ ] Count stats (`format: "int"`) render with total as the headline and average below.
- [ ] Rate stats (`format: "float"`) render with average as the headline and no total line.
- [ ] Percentage stats (`format: "pct"`) render the average with a `%` suffix and no total line.
- [ ] Rank line is shown when a rank is present and omitted when `null`.
- [ ] Refreshing the page preserves the spotlight selection (it comes from the URL).
- [ ] Navigating to a different player profile does not carry the previous player's `spotlight` param.
- [ ] Page-level filters (season, event, etc.) do not change the spotlight numbers.
- [ ] Tile grid wraps naturally on narrow viewports — no horizontal scroll, no special mobile layout.

## Blocked by

Slice 1.
