SELECT
  MIN(TRIM("Regional")) AS label,
  MIN(TRIM("Season")) AS season,
  MIN(TRIM("Split")) AS split,
  MIN("Date"::text) AS min_date,
  MAX("Date"::text) AS max_date
FROM stats
WHERE "Regional" IS NOT NULL
  AND TRIM("Regional") <> ''
  AND (
    TRIM("Season") || ' ' || TRIM("Split") || ' ' || TRIM("Regional")
  ) ILIKE $1
GROUP BY LOWER(TRIM("Season")), LOWER(TRIM("Split")), LOWER(TRIM("Regional"))
ORDER BY MAX("Date") DESC NULLS LAST
LIMIT $2;
