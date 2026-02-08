SELECT DISTINCT "Day" AS value
FROM stats
WHERE "Day" IS NOT NULL
{{where}}
ORDER BY value;
