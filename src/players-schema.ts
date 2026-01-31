export const createPlayersTableSql = `
CREATE TABLE IF NOT EXISTS players (
  id BIGSERIAL PRIMARY KEY,
  "Player ID" TEXT,
  "Primary Handle" TEXT,
  "All Aliases" TEXT,
  "Real Name" TEXT,
  "Pronounciation" TEXT,
  "Date of Birth" TIMESTAMPTZ,
  "Country" TEXT,
  "Twitch" TEXT,
  "TikTok" TEXT,
  "Photo URL" TEXT
);
`;

export const addPlayersColumnsSql = `
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS "Player ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Primary Handle" TEXT,
  ADD COLUMN IF NOT EXISTS "All Aliases" TEXT,
  ADD COLUMN IF NOT EXISTS "Real Name" TEXT,
  ADD COLUMN IF NOT EXISTS "Pronounciation" TEXT,
  ADD COLUMN IF NOT EXISTS "Date of Birth" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "Country" TEXT,
  ADD COLUMN IF NOT EXISTS "Twitch" TEXT,
  ADD COLUMN IF NOT EXISTS "TikTok" TEXT,
  ADD COLUMN IF NOT EXISTS "Photo URL" TEXT;
`;

export const addPlayersTableCommentsSql = `
COMMENT ON COLUMN players."id" IS 'Primary key.';
COMMENT ON COLUMN players."Player ID" IS 'Platform player ID from source data; not necessarily unique.';
COMMENT ON COLUMN players."Primary Handle" IS 'Primary in-game handle.';
COMMENT ON COLUMN players."All Aliases" IS 'Other handles used by the player.';
COMMENT ON COLUMN players."Real Name" IS 'Player''s real name.';
COMMENT ON COLUMN players."Pronounciation" IS 'How to pronounce the player''s name.';
COMMENT ON COLUMN players."Date of Birth" IS 'Player''s date of birth.';
COMMENT ON COLUMN players."Country" IS 'Player''s country.';
COMMENT ON COLUMN players."Twitch" IS 'Player''s Twitch handle or URL.';
COMMENT ON COLUMN players."TikTok" IS 'Player''s TikTok handle or URL.';
COMMENT ON COLUMN players."Photo URL" IS 'Player headshot URL.';
`;
