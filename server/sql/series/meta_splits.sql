SELECT MIN(TRIM("Split")) AS value
FROM stats
WHERE series_id IS NOT NULL
  AND "Split" IS NOT NULL
  AND TRIM("Split") <> ''
{{where}}
GROUP BY LOWER(TRIM("Split"))
ORDER BY value;
