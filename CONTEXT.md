# Context

## Glossary

### Read-only query execution boundary
All agent-generated analytics queries execute through a server-enforced read-only boundary. The boundary allows only a single `SELECT` statement (including `WITH ... SELECT`) and rejects mutation, DDL, multi-statement payloads, and other unsafe SQL constructs.

### Agent query execution path
The chat agent does not connect to Postgres directly. It executes analytics queries through a backend API endpoint that applies validation, authorization, observability, and policy controls before any database execution.

### Agent table access policy
The agent has broad read access across analytics tables. Safety is enforced by execution controls (read-only role, SQL validation, timeouts, and result caps), not by narrow table allowlists.

### Query interaction mode
Agent query work runs in two steps: first `plan_query` (intent, assumptions, expected tables), then `execute_query` (validated SQL execution). This preserves query freedom while keeping intent and execution auditable.

### Agent access scope
The query endpoint is backend-internal and is not exposed as a public direct integration surface in v1.

### Result bounds
Query responses are hard-bounded by server policy. The response explicitly reports bounds and truncation metadata so the agent can adapt query strategy.

### Query budget
The agent may execute multiple queries per user turn, with a hard cap of 15 executions.

### Ambiguous entity handling
Entity resolution primarily relies on model judgment. When multiple plausible entities remain, the agent asks a clarification question instead of silently selecting one.

### Schema awareness strategy
Schema awareness is tool-driven in v1. The agent fetches schema context through dedicated schema tools instead of receiving a manual static schema prompt.

### SQL input contract
Execution uses parameterized query shape (`sql` + `params`) rather than freeform SQL text only.

### Expensive query protection
Primary protection is statement timeout plus response-size bounds. Non-aggregate result queries are required to include `LIMIT`.

### Query audit logging
Each execution emits structured JSONL audit records and mirrored stdout logs for observability and debugging.

### Planning requirement
Every SQL execution requires a prior plan step. Plan records are logged even when no execution follows.

### Plan-execution linkage
Execution requests carry a `planId` so each query is traceable to an explicit intent record.

### Plan validity
Plan identifiers are reusable for multiple queries within the same turn and expire quickly (10 minutes or turn end, whichever is earlier).

### Validation strategy
Validation starts as a pragmatic guardrail set in v1 (read-only role, statement-shape checks, single-statement enforcement), with parser hardening deferred.

### SQL expressiveness
Read-only CTEs and subqueries are allowed.

### Error visibility
Raw database error messages are exposed to the agent in v1.

### Widget disclosure policy
The user-facing widget does not display executed SQL text.

### Rollout scope
The widget is enabled for all users in v1.

### Availability control
Even with broad rollout, the system keeps a kill-switch environment flag to disable agent chat rapidly if needed.

### Access model
There is no sign-in gate in v1; access is anonymous.

### Rate limiting
Anonymous usage is protected by IP-based rate limits with generous defaults and friendly retry responses instead of hard opaque failures.

### Query freshness policy
Query execution always hits the database in v1; no result caching layer is applied.

### Streaming UX
Assistant responses stream in the widget and render through Streamdown.

### Execution transparency
The widget shows explicit progress states during planning/execution/analysis.

### Cancellation behavior
Users can stop in-flight turns. A stopped turn surfaces only a stopped state and does not render partial results.

### Client-side history
Conversation messages persist in local storage across reloads.

### Scope boundary
The agent is strictly scoped to database-backed RLCS analytics for this dataset.

### Out-of-scope handling
Out-of-scope requests receive terse refusal text without examples.

### Answer style
Responses are unambiguous and direct; no hedged confidence language.

### Ambiguity handling
Clarifications are allowed with free-text user responses.

### Context strategy
Conversation context is retained (large cap target), and v1 handles overflow by starting a new chat instead of summarizing older turns.
