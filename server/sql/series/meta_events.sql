SELECT MIN(TRIM("Regional")) AS value
FROM stats
WHERE series_id IS NOT NULL
  AND "Regional" IS NOT NULL
  AND TRIM("Regional") <> ''
{{where}}
GROUP BY LOWER(TRIM("Regional"))
ORDER BY value;
