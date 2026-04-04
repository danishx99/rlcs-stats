# Incremental Ingest Runbook Added

Date: 2026-04-03

Created canonical reusable artifact:
- `docs/incremental-ingest-agent-runbook.md`

Purpose:
- Give any agent a strict, repeatable workflow for incremental data drops.
- Includes ingest steps, integrity + visual verification, commit/push safety gate, and a mandatory return report template.

Operational intent:
- Standardize "safe to commit/push" decisions for ongoing event updates.
- Avoid ad-hoc one-off ingest instructions each time new data arrives.
