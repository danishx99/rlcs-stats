SELECT
  bracket_image_url,
  liquipedia_url
FROM brackets
WHERE LOWER(TRIM(season)) = LOWER($1)
  AND LOWER(TRIM(split)) = LOWER($2)
  AND LOWER(TRIM(event)) = LOWER($3)
LIMIT 1;
