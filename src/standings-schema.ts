export const createStandingsTableSql = `
  CREATE TABLE IF NOT EXISTS standings (
    id         BIGSERIAL PRIMARY KEY,
    season     TEXT    NOT NULL,
    rank       INTEGER NOT NULL,
    team_name  TEXT    NOT NULL,
    points     INTEGER NOT NULL,
    UNIQUE (season, rank)
  );
`;
