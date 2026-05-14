# Slice 1 — Server: accept `?spotlight=` on player profile endpoint

## Parent

`plans/customizable-career-spotlight.md`

## What to build

Extend `GET /api/players/{id}` to accept an optional `spotlight` query parameter, a comma-separated list of stat keys. For each valid, non-default key (up to 8), compute the player's career total, per-game average, and overall ranks (total and average) across all players, then merge the results into the existing `totals`, `averages`, `ranks.total`, and `ranks.avg` objects in the response.

The four default stats (`goals`, `assists`, `saves`, `demos`) keep their current behavior and shape. Spotlight keys that duplicate a default are silently dropped. Keys that are not in the stat catalog are silently dropped. If more than 8 valid custom keys remain, the rest are ignored.

Rank semantics mirror the existing defaults: `ranks.total[key]` is the player's position when ranking all players by career sum of that stat (descending); `ranks.avg[key]` is the position when ranking by per-game average. Either may be `null` if no rank can be computed.

No UI changes. Verifiable via curl against a populated dev DB.

## Acceptance criteria

- [ ] Endpoint accepts `?spotlight=key1,key2,...` and returns the same response shape augmented with the requested keys in `totals`, `averages`, `ranks.total`, and `ranks.avg`.
- [ ] Existing response without the `spotlight` param is byte-identical to today's behavior (no regression for current consumers).
- [ ] Unknown stat keys are dropped silently; the response still returns successfully with whatever valid keys remain.
- [ ] Default keys passed in `spotlight` are dropped (not duplicated, not re-computed).
- [ ] Custom key count is capped at 8 server-side; extras beyond 8 are ignored.
- [ ] The SQL that computes the dynamic ranks is parameterized over the requested keys rather than string-concatenated unsafely.
- [ ] Resolver logic for "one stat key → totals/averages/ranks for that player" is extracted into a single function so future additions only touch one place.

## Blocked by

None — can start immediately.
