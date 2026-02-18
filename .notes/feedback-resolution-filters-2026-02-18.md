# Feedback Resolution Filters (2026-02-18)

- Extended `feedback_submissions` with nullable `resolved_at` (auto-added with `ALTER TABLE ... IF NOT EXISTS` for existing DBs).
- Added feedback list filtering on `GET /api/feedback`:
  - `type=bug|idea|question`
  - `resolved=all|resolved|unresolved` (also accepts `true/false/1/0`).
- Added `PATCH /api/feedback/:id` with body `{ "resolved": boolean }` to mark feedback resolved/unresolved.
- Frontend feedback page now includes:
  - Type filter dropdown.
  - Status filter dropdown (all/resolved/unresolved).
  - Row-level toggle button to mark resolved/unresolved.
