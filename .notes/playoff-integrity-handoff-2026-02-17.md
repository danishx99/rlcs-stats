# Playoff Data Integrity Handoff

Date: 2026-02-17  
Scope: Confirmed remaining playoff progression data issues from integrity checks (`C17`/`C18`).

## Summary

- Structural integrity is largely clean.
- Remaining blockers are playoff progression records.
- Confirmed root causes are:
  - Missing FF follow-up series rows (2 confirmed).
  - Event labeling collision for one qualifier instance (1 confirmed).

## Issue Group 1: Missing Follow-Up Series Rows (Confirmed)

### 1) BOT GAMING chain

- Last recorded winning series:
  - Matchup: `BOT GAMING` vs `YANKEES WITH NO BRIM`
  - Round: `LR2`
  - Event labels: `2021-22 / Winter / Regional Event 3 / Playoffs`
- Recorded match IDs:
  - `20220226-170654-2021-22-Winter-Regional Event 3-Playoffs-LR2-G1`
  - `20220226-171625-2021-22-Winter-Regional Event 3-Playoffs-LR2-G2`
  - `20220226-172534-2021-22-Winter-Regional Event 3-Playoffs-LR2-G3`
- Confirmed missing follow-up:
  - `ATK` vs `BOT GAMING`
  - Outcome context: FF win for `ATK`

### 2) TRADUIS SI TU PUES chain

- Last recorded winning series:
  - Matchup: `TRADUIS SI TU PUES` vs `GENESIX`
  - Round: `LR1`
  - Event labels: `2025 / Raleigh Major / Open 6 / Playoffs`
- Recorded match IDs:
  - `20250524-180116-2025-Raleigh Major-Open 6-Playoffs-LR1-G1`
  - `20250524-180857-2025-Raleigh Major-Open 6-Playoffs-LR1-G2`
  - `20250524-181559-2025-Raleigh Major-Open 6-Playoffs-LR1-G3`
  - `20250524-182338-2025-Raleigh Major-Open 6-Playoffs-LR1-G4`
  - `20250524-183337-2025-Raleigh Major-Open 6-Playoffs-LR1-G5`
- Confirmed missing follow-up:
  - `HEY (WITH RIZZ)` vs `TRADUIS SI TU PUES`
  - Outcome context: FF win for `HEY (WITH RIZZ)`

## Issue Group 2: Event Labeling Collision (Confirmed)

- A series currently flagged as missing-follow-up is likely mislabeled:
  - Matchup: `LIMITLESS` vs `YOUNG MONEY CLAN`
  - Round: `QF`
  - Label in data: `2024 / Major 1 / Open Qualifier 1 / Playoffs`
- Match IDs in this isolated block:
  - `20240302-17.00-2024-Major 1-Open Qualifier 1-Playoffs-QF-G1`
  - `20240302-17.01-2024-Major 1-Open Qualifier 1-Playoffs-QF-G2`
  - `20240302-17.02-2024-Major 1-Open Qualifier 1-Playoffs-QF-G3`
  - `20240302-17.03-2024-Major 1-Open Qualifier 1-Playoffs-QF-G4`

### Why this is a labeling issue

- Two distinct playoff instances share the same labels:
  - Instance A: 2024-02-03 to 2024-02-04 (QF/SF/GF chain).
  - Instance B: 2024-03-02 (QF-only block).
- Recommendation:
  - Relabel Instance B to the correct qualifier/event name.

## Requested Data Fix Actions

1. Add missing FF series row-set for `ATK` vs `BOT GAMING`.
2. Add missing FF series row-set for `HEY (WITH RIZZ)` vs `TRADUIS SI TU PUES`.
3. Correct event labeling for the 2024-03-02 `LIMITLESS` vs `YOUNG MONEY CLAN` qualifier block.
