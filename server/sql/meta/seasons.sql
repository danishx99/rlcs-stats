SELECT MIN(TRIM("Season")) AS value
FROM stats
WHERE "Season" IS NOT NULL AND TRIM("Season") <> ''
{{where}}
GROUP BY LOWER(TRIM("Season"))
ORDER BY value;
