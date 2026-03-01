SELECT MIN(TRIM("scope")) AS value
FROM stats
WHERE "scope" IS NOT NULL
  AND TRIM("scope") <> ''
{{where}}
GROUP BY LOWER(TRIM("scope"))
ORDER BY
  CASE LOWER(MIN(TRIM("scope")))
    WHEN 'regional' THEN 1
    WHEN 'international' THEN 2
    ELSE 99
  END,
  value;
