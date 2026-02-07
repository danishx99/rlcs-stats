# Team Assignment Anomaly: Open 3 USF Game 1 (2026-01-30)

## Summary
- Match ID: `20260130-155020-2026-Boston Major-Open 3-GSL-USF-G1`
- Affected players:
  - `SSA-P-10123` (`Duklaz`)
  - `SSA-P-10131` (`gunz`)
- Issue: `Team` appears swapped for these two players in this single game.

## Observed Pattern
- In this match (Game 1), rows show:
  - `SSA-P-10123` on `FIVE FEARS`
  - `SSA-P-10131` on `TEAM HSK`
- In Games 2/3 of the same series and surrounding Open 3 matches, the stable pattern is:
  - `SSA-P-10123` on `TEAM HSK`
  - `SSA-P-10131` on `FIVE FEARS`

## Decision
- Treat this as a `Team` field misassignment.
- Do **not** swap player IDs or names.

## Targeted Fix
```sql
BEGIN;

UPDATE stats
SET "Team" = CASE
  WHEN NULLIF(TRIM("Unique ID"), '') = 'SSA-P-10123' THEN 'TEAM HSK'
  WHEN NULLIF(TRIM("Unique ID"), '') = 'SSA-P-10131' THEN 'FIVE FEARS'
  ELSE "Team"
END
WHERE "Match ID" = '20260130-155020-2026-Boston Major-Open 3-GSL-USF-G1'
  AND NULLIF(TRIM("Unique ID"), '') IN ('SSA-P-10123', 'SSA-P-10131');

COMMIT;
```

## Post-fix verification
```sql
SELECT
  "Match ID",
  "Game Number",
  NULLIF(TRIM("Unique ID"), '') AS uid,
  "Player Name",
  TRIM("Team") AS team
FROM stats
WHERE "Match ID" = '20260130-155020-2026-Boston Major-Open 3-GSL-USF-G1'
  AND NULLIF(TRIM("Unique ID"), '') IN ('SSA-P-10123', 'SSA-P-10131')
ORDER BY uid;
```
