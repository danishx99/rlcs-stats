SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'stats'
  AND data_type IN ('double precision', 'integer', 'bigint', 'numeric', 'real')
ORDER BY ordinal_position;
