SELECT MIN(TRIM("Regional")) AS value
FROM stats
WHERE "Regional" IS NOT NULL AND TRIM("Regional") <> ''
{{where}}
GROUP BY LOWER(TRIM("Regional"))
ORDER BY value;
