(
  SELECT
    p."Unique ID" AS id,
    p."Primary Handle" AS label,
    p."Real Name" AS real_name,
    p."Photo URL" AS photo_url,
    p."Country" AS country
  FROM players p
  WHERE p."Primary Handle" ILIKE {{likeParam}}
     OR p.aka ILIKE {{likeParam}}
     OR p."Real Name" ILIKE {{likeParam}}
)
UNION
(
  SELECT DISTINCT ON ({{playerKeyExpr}})
    {{playerKeyExpr}} AS id,
    s."Player Name" AS label,
    NULL AS real_name,
    NULL AS photo_url,
    NULL AS country
  FROM stats s
  LEFT JOIN players p ON p."Unique ID" = {{playerKeyExpr}}
  WHERE p."Unique ID" IS NULL
    AND s."Player Name" ILIKE {{likeParam}}
  ORDER BY {{playerKeyExpr}}
  LIMIT {{limitParam}}
)
ORDER BY label
LIMIT {{limitParam}};
