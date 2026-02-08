SELECT MIN(TRIM("Team")) AS value
FROM stats
WHERE series_id IS NOT NULL
  AND "Team" IS NOT NULL
  AND TRIM("Team") <> ''
{{where}}
GROUP BY LOWER(TRIM("Team"))
ORDER BY value;
