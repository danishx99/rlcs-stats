export const createTeamProfilesTableSql = `
CREATE TABLE IF NOT EXISTS team_profiles (
  id BIGSERIAL PRIMARY KEY,
  "Team Name" TEXT,
  "Logo Link" TEXT,
  "Twitter" TEXT,
  "TikTok" TEXT,
  "Youtube" TEXT,
  "Twitch" TEXT
);
`;

export const addTeamProfilesColumnsSql = `
ALTER TABLE team_profiles
  ADD COLUMN IF NOT EXISTS "Team Name" TEXT,
  ADD COLUMN IF NOT EXISTS "Logo Link" TEXT,
  ADD COLUMN IF NOT EXISTS "Twitter" TEXT,
  ADD COLUMN IF NOT EXISTS "TikTok" TEXT,
  ADD COLUMN IF NOT EXISTS "Youtube" TEXT,
  ADD COLUMN IF NOT EXISTS "Twitch" TEXT;
`;

export const addTeamProfilesCommentsSql = `
COMMENT ON COLUMN team_profiles."id" IS 'Primary key.';
COMMENT ON COLUMN team_profiles."Team Name" IS 'Team display name (ALL CAPS in source data).';
COMMENT ON COLUMN team_profiles."Logo Link" IS 'URL to team logo image.';
COMMENT ON COLUMN team_profiles."Twitter" IS 'Team Twitter handle or URL.';
COMMENT ON COLUMN team_profiles."TikTok" IS 'Team TikTok handle or URL.';
COMMENT ON COLUMN team_profiles."Youtube" IS 'Team YouTube channel URL.';
COMMENT ON COLUMN team_profiles."Twitch" IS 'Team Twitch handle or URL.';
`;
