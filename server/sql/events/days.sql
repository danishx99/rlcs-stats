SELECT day
FROM (
  SELECT DISTINCT TRIM(s."Day"::text) AS day
  FROM stats s
  WHERE s."Event" = $1
    AND ($2::text IS NULL OR s."Season" = $2)
    AND ($3::text IS NULL OR s."Split" = $3)
    AND ($4::text IS NULL OR s."mode" = $4)
    AND ($5::text IS NULL OR s."scope" = $5)
    AND ($6::text IS NULL OR s."tier" = $6)
) day_options
WHERE day IS NOT NULL
  AND day <> ''
ORDER BY day::int, day;
