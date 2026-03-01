WITH scoped AS (
  SELECT
    s.*,
    md5(
      LOWER(TRIM(COALESCE(s."Season", ''))) || '|' ||
      LOWER(TRIM(COALESCE(s."Split", ''))) || '|' ||
      LOWER(TRIM(COALESCE(s."Event", ''))) || '|' ||
      LOWER(TRIM(COALESCE(s."mode", ''))) || '|' ||
      LOWER(TRIM(COALESCE(s."scope", ''))) || '|' ||
      LOWER(TRIM(COALESCE(s."tier", '')))
    ) AS event_id
  FROM stats s
  WHERE s."Event" IS NOT NULL
    AND TRIM(s."Event") <> ''
)
SELECT
  MIN(TRIM(scoped."Event")) AS event_name,
  MIN(TRIM(scoped."Season")) AS season,
  MIN(TRIM(scoped."Split")) AS split,
  MIN(TRIM(scoped."mode")) AS mode,
  MIN(TRIM(scoped."scope")) AS scope,
  MIN(TRIM(scoped."tier")) AS tier,
  MIN(scoped."Date"::text) AS min_date,
  MAX(scoped."Date"::text) AS max_date,
  COUNT(DISTINCT scoped.series_id) AS total_series,
  COUNT(DISTINCT NULLIF(TRIM(scoped."Unique ID"), '')) AS total_players,
  MIN(scoped.event_id) AS event_id
FROM scoped
WHERE scoped.event_id = $1;
