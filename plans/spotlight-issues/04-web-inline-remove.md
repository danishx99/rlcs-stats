# Slice 4 — Web: inline × on hover for custom tiles

## Parent

`plans/customizable-career-spotlight.md`

## What to build

Add a small × control to each custom tile in the Career Spotlight grid, visible on hover (and always visible on touch devices, since hover does not apply). Clicking it removes that stat from the URL `spotlight` param, which removes the tile via Slice 2's read path.

The four default tiles (`goals`, `assists`, `saves`, `demos`) never render the × control and remain unremovable.

## Acceptance criteria

- [ ] Custom tiles show an × control on hover (top-right corner of the tile).
- [ ] Clicking the × removes that key from the URL `spotlight` param and the tile disappears.
- [ ] Default tiles never show the × and cannot be removed.
- [ ] On touch devices where `:hover` is not reliable, the × is reachable (e.g., always visible, or revealed on focus/tap).
- [ ] Removing a tile via the × is functionally equivalent to deselecting it in the StatPicker.

## Blocked by

Slice 3.
