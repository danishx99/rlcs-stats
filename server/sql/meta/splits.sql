SELECT MIN(TRIM("Split")) AS value
FROM stats
WHERE "Split" IS NOT NULL AND TRIM("Split") <> ''
{{where}}
GROUP BY LOWER(TRIM("Split"))
ORDER BY value;
