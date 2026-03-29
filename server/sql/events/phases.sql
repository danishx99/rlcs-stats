SELECT phase
FROM (
  SELECT DISTINCT TRIM(s."Stage") AS phase
  FROM stats s
  WHERE LOWER(TRIM(s."Event")) = LOWER($1)
    AND ($2::text IS NULL OR LOWER(TRIM(s."Season")) = LOWER($2))
    AND ($3::text IS NULL OR LOWER(TRIM(s."Split")) = LOWER($3))
    AND ($4::text IS NULL OR LOWER(TRIM(s."mode")) = LOWER($4))
    AND ($5::text IS NULL OR LOWER(TRIM(s."scope")) = LOWER($5))
    AND ($6::text IS NULL OR LOWER(TRIM(s."tier")) = LOWER($6))
) phase_options
WHERE phase IS NOT NULL
  AND phase <> ''
ORDER BY
  phase;
