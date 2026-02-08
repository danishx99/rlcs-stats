SELECT MIN(TRIM("Stage")) AS value
FROM stats
WHERE series_id IS NOT NULL
  AND "Stage" IS NOT NULL
  AND TRIM("Stage") <> ''
{{where}}
GROUP BY LOWER(TRIM("Stage"))
ORDER BY value;
