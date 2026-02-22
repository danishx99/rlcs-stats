export const createBracketsTableSql = `
CREATE TABLE IF NOT EXISTS brackets (
  id BIGSERIAL PRIMARY KEY,
  season TEXT NOT NULL,
  split TEXT NOT NULL,
  event TEXT NOT NULL,
  bracket_image_url TEXT NOT NULL,
  liquipedia_url TEXT NOT NULL,
  UNIQUE (season, split, event)
);
`;

export const addBracketsColumnsSql = `
ALTER TABLE brackets
  ADD COLUMN IF NOT EXISTS season TEXT,
  ADD COLUMN IF NOT EXISTS split TEXT,
  ADD COLUMN IF NOT EXISTS event TEXT,
  ADD COLUMN IF NOT EXISTS bracket_image_url TEXT,
  ADD COLUMN IF NOT EXISTS liquipedia_url TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'brackets'
      AND column_name = 'regional'
  ) THEN
    EXECUTE 'UPDATE brackets SET event = regional WHERE event IS NULL AND regional IS NOT NULL';
    EXECUTE 'ALTER TABLE brackets ALTER COLUMN regional DROP NOT NULL';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS brackets_season_split_event_uq
  ON brackets (season, split, event);
`;
