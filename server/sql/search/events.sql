SELECT
  md5(
    LOWER(TRIM(COALESCE("Season", ''))) || '|' ||
    LOWER(TRIM(COALESCE("Split", ''))) || '|' ||
    LOWER(TRIM(COALESCE("Event", ''))) || '|' ||
    LOWER(TRIM(COALESCE("mode", ''))) || '|' ||
    LOWER(TRIM(COALESCE("scope", ''))) || '|' ||
    LOWER(TRIM(COALESCE("tier", '')))
  ) AS event_id,
  MIN(TRIM("Event")) AS label,
  MIN(TRIM("Season")) AS season,
  MIN(TRIM("Split")) AS split,
  MIN(TRIM("mode")) AS mode,
  MIN(TRIM("scope")) AS scope,
  MIN(TRIM("tier")) AS tier,
  MIN("Date"::text) AS min_date,
  MAX("Date"::text) AS max_date
FROM stats s
WHERE "Event" IS NOT NULL
  AND TRIM("Event") <> ''
  {{where}}
  AND (
    TRIM("Season") || ' ' || TRIM("Split") || ' ' || TRIM("Event") || ' ' || TRIM("mode") || ' ' || TRIM("scope") || ' ' || TRIM("tier")
  ) ILIKE {{likeParam}}
GROUP BY
  LOWER(TRIM(COALESCE("Season", ''))),
  LOWER(TRIM(COALESCE("Split", ''))),
  LOWER(TRIM(COALESCE("Event", ''))),
  LOWER(TRIM(COALESCE("mode", ''))),
  LOWER(TRIM(COALESCE("scope", ''))),
  LOWER(TRIM(COALESCE("tier", '')))
ORDER BY MAX("Date") DESC NULLS LAST
LIMIT {{limitParam}};
