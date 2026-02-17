export const createBracketsTableSql = `
CREATE TABLE IF NOT EXISTS brackets (
  id BIGSERIAL PRIMARY KEY,
  season TEXT NOT NULL,
  split TEXT NOT NULL,
  regional TEXT NOT NULL,
  bracket_image_url TEXT NOT NULL,
  liquipedia_url TEXT NOT NULL,
  UNIQUE (season, split, regional)
);
`;

export const addBracketsColumnsSql = `
ALTER TABLE brackets
  ADD COLUMN IF NOT EXISTS season TEXT,
  ADD COLUMN IF NOT EXISTS split TEXT,
  ADD COLUMN IF NOT EXISTS regional TEXT,
  ADD COLUMN IF NOT EXISTS bracket_image_url TEXT,
  ADD COLUMN IF NOT EXISTS liquipedia_url TEXT;
`;
