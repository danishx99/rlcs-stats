# Slice 3 — Web: StatPicker trigger in section header + selection cap

## Parent

`plans/customizable-career-spotlight.md`

## What to build

Add a "+ Add Stat" button to the Career Spotlight section header (right side, opposite the title), wired to the existing `StatPicker` component in multi-select dropdown mode. The picker shows the full stat catalog grouped by category, with the same search behavior used on the Stat, Event, and Compare pages.

The picker's `selected` list reflects only the custom additions parsed from the URL `spotlight` param — the four defaults are not togglable and do not appear as selected. Toggling a stat in the picker updates the URL (adding the key in selection order, or removing it), which in turn drives the rendered tiles via Slice 2's read path.

Enforce the 8-custom cap by passing `disabledKeys` to the picker: once 8 keys are selected, every other catalog key becomes a disabled checkbox showing the existing "Stat selection cap reached" tooltip. Currently-selected keys remain interactive so the user can deselect.

## Acceptance criteria

- [ ] "+ Add Stat" button appears in the Career Spotlight section header and opens the StatPicker dropdown.
- [ ] Picker behavior (search, grouping, popover dismissal) matches the Stat/Event/Compare pages exactly — same component, no fork.
- [ ] Selecting a stat appends its key to the URL `spotlight` param and renders a new tile.
- [ ] Deselecting a stat removes its key from the URL and removes the tile.
- [ ] Selection order in the URL equals tile order in the grid.
- [ ] Default stat keys (`goals`, `assists`, `saves`, `demos`) are not shown as selectable in the picker (or, equivalently, toggling them is a no-op and they never appear in the URL).
- [ ] When 8 custom stats are selected, all other catalog stats appear disabled in the picker with the existing tooltip; the 8 selected stats remain interactive.

## Blocked by

Slice 2.
