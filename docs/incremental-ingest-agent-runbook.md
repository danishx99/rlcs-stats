# Incremental Data Ingest Agent Runbook

This is the canonical artifact to hand to an agent whenever new RLCS data arrives in increments (new event rows, players, orgs, standings, brackets).

The objective is to safely ingest into the local database, verify integrity and UI visibility, then decide if it is safe to commit and push.

## How to Use This Artifact

Tell the agent: "Follow `docs/incremental-ingest-agent-runbook.md` exactly and return the completed report template."

The agent must run every phase in order and must not commit or push unless all required gates pass.

## Inputs Required Per Run

Before execution, fill this context in your prompt to the agent:

```text
Data drop label: <short label, e.g. 2026-04-Regional-3-Day2>
Why this ingest: <what changed>
Expected new events: <comma-separated event names or "none">
Expected new players: <count or list>
Expected new orgs/teams: <count or list>
Expected changed existing files: <list of csv files>
Commit mode: <"do not commit", "commit only", or "commit and push">
```

If you do not provide these values, the agent should infer them from git diff + CSV content and mark inferred values explicitly in the report.

## Phase 1: Preflight and Environment

1. Confirm repo status and current branch:

```bash
git status --short
git branch --show-current
```

2. Ensure local DB services are running:

```bash
docker compose up -d
```

3. Ensure dependencies are installed:

```bash
bun install
```

4. Capture a baseline snapshot for comparison:

```bash
psql "${DATABASE_URL:-postgres://stats:stats_pw@localhost:5432/statsdb}" -P pager=off -c "SELECT COUNT(*) AS stats_rows FROM stats;"
psql "${DATABASE_URL:-postgres://stats:stats_pw@localhost:5432/statsdb}" -P pager=off -c "SELECT COUNT(*) AS players_rows FROM players;"
psql "${DATABASE_URL:-postgres://stats:stats_pw@localhost:5432/statsdb}" -P pager=off -c "SELECT COUNT(*) AS team_profiles_rows FROM team_profiles;"
```

## Phase 2: Safe Ingest Execution

1. Run strict dry-run first (no writes):

```bash
bun run src/run.ts --dir ./data --sync --dry-run --strict
```

2. If dry-run fails because new columns exist, resolve schema intentionally:
Run once with `--allow-new-columns`, then immediately update schema files to canonical types and document it in the report.

3. Run real ingest:

```bash
bun run db:load
```

4. Save `out/import-report.json` evidence into the final report summary.

## Phase 3: Data Integrity Verification (Required)

1. Run core integrity check script:

```bash
bun run verify:data
```

2. Run full SQL integrity audit:

```bash
psql "${DATABASE_URL:-postgres://stats:stats_pw@localhost:5432/statsdb}" -P pager=off -f "sql/data-integrity.sql"
```

3. Fail conditions:
If any `critical` check reports `status = fail`, mark run as NOT SAFE TO COMMIT and stop before commit/push.

4. Targeted incremental checks for this data drop:

```bash
psql "${DATABASE_URL:-postgres://stats:stats_pw@localhost:5432/statsdb}" -P pager=off -c "
SELECT
  \"Season\",
  \"Split\",
  \"Event\",
  COUNT(*) AS rows
FROM stats
GROUP BY 1,2,3
ORDER BY MAX(ingested_at) DESC
LIMIT 20;"

psql "${DATABASE_URL:-postgres://stats:stats_pw@localhost:5432/statsdb}" -P pager=off -c "
SELECT
  COUNT(DISTINCT NULLIF(TRIM(s.\"Unique ID\"), '')) AS stats_unique_ids,
  COUNT(DISTINCT NULLIF(TRIM(p.\"Unique ID\"), '')) AS players_unique_ids
FROM stats s
LEFT JOIN players p ON NULLIF(TRIM(s.\"Unique ID\"), '') = NULLIF(TRIM(p.\"Unique ID\"), '');"

psql "${DATABASE_URL:-postgres://stats:stats_pw@localhost:5432/statsdb}" -P pager=off -c "
SELECT
  \"Team Name\",
  COUNT(*) AS rows
FROM team_profiles
GROUP BY 1
ORDER BY MAX(ingested_at) DESC
LIMIT 20;"
```

## Phase 4: Visual Verification (Required)

Start the app and verify the increment is visible in UI:

```bash
bun run dev
```

Use this checklist:

1. Home page `/` search must find at least one expected new event, one expected new player, and one expected new org/team.
2. Event page `/events/:eventId` for at least one new event shows:
event header, placements list, and no obvious empty-state mismatch.
3. Player page `/players/:uniqueId` for at least two new players shows:
overview data and at least one season/results row.
4. Roster page `/rosters/:rosterId` for at least one new org/team shows:
profile header and roster iteration content.
5. Compare or stat navigation still loads (regression smoke check).

If any check fails, mark run as NOT SAFE TO COMMIT and include exact failing URL + symptom.

## Phase 5: Commit/Push Safety Gate

All required checks must pass before commit:

1. Ingest succeeded without unresolved errors.
2. `bun run verify:data` passed.
3. `sql/data-integrity.sql` has no `critical` failures.
4. Visual verification checklist passed.
5. Tests passed:

```bash
bun run test
```

6. Production build passed. Repo policy requires `bun run build`; this repo currently exposes:

```bash
bun run build:web
```

If `bun run build` is later added, run that instead.

7. Git diff only contains expected files for this increment.

If any gate fails: do not commit or push.

## Phase 6: Commit and Push Procedure

Only run this phase when commit mode allows it and all gates passed.

1. Review diff:

```bash
git status
git diff --stat
```

2. Commit with an explicit ingest subject:

```bash
git add -A
git commit -m "Ingest RLCS data increment: <data drop label>"
```

3. If commit mode is `commit and push`:

```bash
git push
```

## Reusable Report Template (Agent Must Return This)

```md
# Incremental Ingest Report

Date: <YYYY-MM-DD>
Data drop label: <label>
Branch: <branch>
Commit mode: <do not commit | commit only | commit and push>

## 1) Scope
Known:
<what was provided by Danish>

Inferred:
<what the agent inferred from changed files/content>

## 2) Ingest Execution
Dry-run strict: <pass/fail + notes>
Real ingest: <pass/fail + notes>
Import report summary:
- files processed: <n>
- rows read: <n>
- inserted: <n>
- skipped: <n>
- errored: <n>

## 3) Integrity Verification
verify:data: <pass/fail + output summary>
data-integrity.sql critical checks: <pass/fail>
Warnings worth noting:
<list or "none">

Targeted incremental checks:
<what new events/players/orgs were confirmed>

## 4) Visual Verification
Checked URLs:
<url list>

Findings:
<pass/fail observations>

## 5) Safety Decision
Safe to commit: <yes/no>
Safe to push: <yes/no>
Reason:
<single direct reasoned conclusion>

## 6) Git Actions Taken
Commit created: <yes/no>
Commit hash: <hash or n/a>
Push completed: <yes/no>

## 7) Follow-ups
<only actionable follow-ups; otherwise "none">
```

## Non-Negotiable Rules for the Agent

Never push if integrity gates fail.

Never silently bypass failed checks.

Never add compatibility/migration shims to "make data pass"; fix data or fail fast with explicit diagnostics.
