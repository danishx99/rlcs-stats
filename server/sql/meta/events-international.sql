SELECT MIN(TRIM("Event")) AS value
FROM stats
WHERE "Event" IS NOT NULL
  AND TRIM("Event") <> ''
  AND LOWER(TRIM("scope")) = 'international'
{{where}}
GROUP BY LOWER(TRIM("Event"))
ORDER BY value;
