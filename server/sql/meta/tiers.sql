SELECT MIN(TRIM("tier")) AS value
FROM stats
WHERE "tier" IS NOT NULL
  AND TRIM("tier") <> ''
{{where}}
GROUP BY LOWER(TRIM("tier"))
ORDER BY
  CASE LOWER(MIN(TRIM("tier")))
    WHEN 'none' THEN 1
    WHEN 'major' THEN 2
    WHEN 'worlds' THEN 3
    ELSE 99
  END,
  value;
