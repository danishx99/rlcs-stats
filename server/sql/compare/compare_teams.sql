WITH base AS (
  SELECT
    s.*
  FROM stats s
  {{where}}
)
SELECT
  base."Team" AS id,
  base."Team" AS label,
  COUNT(*) AS games,
  {{metricSelect}}
FROM base
WHERE base."Team" = ANY({{idsParam}})
GROUP BY base."Team"
ORDER BY base."Team";
