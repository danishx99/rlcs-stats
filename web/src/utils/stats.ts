// Keys for "milestone" stats — synthetic counters that have no clean team-level
// definition. Hidden from the picker (and silently dropped from the URL) when
// the user is in team/roster mode. Keep in sync with MILESTONE_STAT_KEYS in
// server/src/utils/stats.ts.
export const MILESTONE_STAT_KEYS: ReadonlySet<string> = new Set([
  "games_played",
  "hat_tricks",
  "saviours",
  "exterminations",
  "ot_games",
  "mvps"
]);
