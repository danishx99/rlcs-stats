# Feedback Widget Notes (2026-02-11)

- Added `POST /api/feedback` for write-only submissions (no read endpoint in v1).
- Feedback data is stored in `feedback_submissions` with:
  - `feedback_type`, `message`
  - page context columns (`page_url`, `page_path`, `page_search`, `page_hash`, `page_title`)
  - `client_context` JSONB
  - `server_context` JSONB
- API boot now ensures feedback table + indexes exist before listening.
- Raw IP is not stored. `server_context` stores `ipHash` (`sha256`) instead.
- Frontend adds a floating feedback button gated by `VITE_FEEDBACK_ENABLED`.
- Form fields are `type` + `message`; contact fields intentionally omitted for initial tester phase.
