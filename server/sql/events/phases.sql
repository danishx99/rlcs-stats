SELECT phase
FROM (
  SELECT DISTINCT TRIM(s."Stage") AS phase
  FROM stats s
  WHERE s."Event" = $1
    AND ($2::text IS NULL OR s."Season" = $2)
    AND ($3::text IS NULL OR s."Split" = $3)
    AND ($4::text IS NULL OR s."mode" = $4)
    AND ($5::text IS NULL OR s."scope" = $5)
    AND ($6::text IS NULL OR s."tier" = $6)
) phase_options
WHERE phase IS NOT NULL
  AND phase <> ''
ORDER BY
  phase;
