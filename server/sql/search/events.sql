SELECT
  MIN(TRIM("Event")) AS label,
  MIN(TRIM("Season")) AS season,
  MIN(TRIM("Split")) AS split,
  MIN("Date"::text) AS min_date,
  MAX("Date"::text) AS max_date
FROM stats
WHERE "Event" IS NOT NULL
  AND TRIM("Event") <> ''
  AND (
    TRIM("Season") || ' ' || TRIM("Split") || ' ' || TRIM("Event")
  ) ILIKE $1
GROUP BY LOWER(TRIM("Season")), LOWER(TRIM("Split")), LOWER(TRIM("Event"))
ORDER BY MAX("Date") DESC NULLS LAST
LIMIT $2;
