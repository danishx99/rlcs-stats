SELECT value
FROM (
  SELECT DISTINCT TRIM("Arena") AS value
  FROM stats
  WHERE "Arena" IS NOT NULL AND TRIM("Arena") <> ''
) arenas
ORDER BY
  CASE WHEN LOWER(value) = 'unknown map' THEN 1 ELSE 0 END,
  value;
