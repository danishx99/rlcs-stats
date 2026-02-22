SELECT MIN(TRIM("Event")) AS value
FROM stats
WHERE series_id IS NOT NULL
  AND "Event" IS NOT NULL
  AND TRIM("Event") <> ''
{{where}}
GROUP BY LOWER(TRIM("Event"))
ORDER BY value;
