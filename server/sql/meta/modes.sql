SELECT MIN(TRIM("mode")) AS value
FROM stats
WHERE "mode" IS NOT NULL
  AND TRIM("mode") <> ''
{{where}}
GROUP BY LOWER(TRIM("mode"))
ORDER BY
  CASE LOWER(MIN(TRIM("mode")))
    WHEN '1s' THEN 1
    WHEN '2s' THEN 2
    WHEN '3s' THEN 3
    ELSE 99
  END,
  value;
