# Slice 2 — Share button on the Stat Page (with `useShare` extraction)

**Parent:** [plans/multi-stat-grid.md](./multi-stat-grid.md)
**Type:** AFK

## What to build

The Stat Page is now dashboard-shaped (Slice 1) and the URL fully captures the view. Add a Share affordance so users can send the exact view they're looking at, mirroring the affordance that already exists on the Event Page.

End-to-end behavior:

- A **Share** button sits in the Stat Page control bar (near the picker and See All). Clicking it invokes the Web Share API where available (mobile, modern browsers) with a sensible title and text derived from the current view; otherwise falls back to copying the current URL to the clipboard. A short transient confirmation is shown (busy → "Link copied" / "Shared").
- The same behavior already lives inline on the Event Page (`handleShare`). Extract it into a small reusable hook — `useShare(title, text)` — and refactor the Event Page to use the same hook so the two pages don't drift.
- Share title for the Stat Page is something descriptive like `RLCS Stats · Leaderboards` (or include the anchor stat's label if useful). Share text can summarize the filter scope, similar to the subheading. Exact copy is a small design call left to the implementer; just ensure it isn't blank.

## Acceptance criteria

- [ ] A **Share** button is visible in the Stat Page control bar.
- [ ] On a browser with `navigator.share`, clicking it opens the native share sheet with a non-empty title, text, and the current URL.
- [ ] On a browser without `navigator.share`, clicking it copies the current URL to the clipboard and shows a transient confirmation.
- [ ] The Event Page's Share button still works identically to how it works today and is implemented via the same hook.
- [ ] The hook is reusable enough that a third caller could adopt it without modification (signature takes title/text/url; no page-specific assumptions baked in).
- [ ] No regression to the existing Event Page share behavior (busy state, message, error handling).

## Blocked by

Slice 1 — the Share button lives in the new Stat Page control bar introduced there.
