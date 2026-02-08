export type StatOption = {
  key: string;
  label: string;
  format?: "int" | "float" | "pct";
};

export type MetaResponse = {
  generatedAt: string;
  seasons: string[];
  splits: string[];
  events: string[];
  statOptions: StatOption[];
  featuredOptions?: StatOption[];
};

export type SeriesMetaResponse = {
  generatedAt: string;
  seasons: string[];
  splits: string[];
  events: string[];
  stages: string[];
  teams: string[];
};

export type SeriesListRow = {
  seriesId: string;
  date: string | null;
  season: string | null;
  split: string | null;
  event: string | null;
  stage: string | null;
  round: string | null;
  day: number | null;
  bestOf: number | null;
  teamA: string | null;
  teamB: string | null;
  teamAWins: number;
  teamBWins: number;
  gamesRecorded: number;
};

export type SeriesListResponse = {
  rows: SeriesListRow[];
};

export type SeriesGame = {
  gameNumber: number;
  matchId: string | null;
  teamAGoals: number | null;
  teamBGoals: number | null;
  winnerTeam: string | null;
};

export type SeriesDetail = SeriesListRow & {
  games: SeriesGame[];
};

export type SeriesDetailResponse = {
  series: SeriesDetail;
};

export type SearchResult = {
  id: string;
  label: string;
  type: "player" | "roster" | "stat";
  meta?: {
    photoUrl?: string | null;
    country?: string | null;
    starters?: string[] | null;
    realName?: string | null;
  };
};

export type SearchResponse = {
  players: SearchResult[];
  rosters: SearchResult[];
  stats: SearchResult[];
};

export type PlayerProfile = {
  id: string;
  handle: string | null;
  playerName: string | null;
  aliases: string | null;
  realName: string | null;
  country: string | null;
  photoUrl: string | null;
  dateOfBirth: string | null;
  debut: string | null;
  bestResult: string | null;
  twitch?: string | null;
  tiktok?: string | null;
  teams: string[];
  games: number;
  seriesPlayed: number;
  totals: Record<string, number>;
  averages: Record<string, number>;
};

export type RosterStarter = {
  id: string;
  handle: string | null;
};

export type RosterAlternate = {
  id: string;
  handle: string | null;
  appearances?: number | null;
};

export type RosterProfile = {
  id: string;
  name: string | null;
  starters: RosterStarter[];
  alternates: RosterAlternate[];
  debut: string | null;
  bestResult: string | null;
  games: number;
  seriesPlayed: number;
  totals: Record<string, number>;
  averages: Record<string, number>;
};

export type CompareMetric = {
  key: string;
  label: string;
};

export type CompareRow = {
  id: string;
  label: string;
  teams?: string[];
  games: number;
  values: Record<string, number>;
};

export type CompareResponse = {
  mode: "avg" | "total";
  metrics: CompareMetric[];
  rows: CompareRow[];
};

export type CompareHistoryEntity = {
  id: string;
  label: string | null;
};

export type CompareHistoryTeam = {
  team: string | null;
  wins: number;
  bestOf: number | null;
  entities: CompareHistoryEntity[] | null;
};

export type CompareHistoryRow = {
  series_id: string;
  date: string | null;
  season: string | null;
  split: string | null;
  regional: string | null;
  stage: string | null;
  round: string | null;
  teams: CompareHistoryTeam[] | null;
};

export type CompareHistoryResponse = {
  rows: CompareHistoryRow[];
};

export type LeaderboardRow = {
  id: string;
  label: string;
  teams: string[];
  photoUrl?: string | null;
  country?: string | null;
  value: number;
};

export type LeaderboardResponse = {
  mode: "avg" | "total";
  metric: StatOption;
  rows: LeaderboardRow[];
};

export type FeaturedColumn = {
  key: string;
  label: string;
  format?: "int" | "float" | "pct";
};

export type FeaturedRow = {
  id: string;
  label: string;
  teams: string[];
  value: number;
  photoUrl?: string | null;
  extras: Record<string, number>;
};

export type FeaturedResponse = {
  mode: "avg" | "total";
  metric: StatOption;
  columns: FeaturedColumn[];
  rows: FeaturedRow[];
};

export type StatCategory = {
  name: string;
  stats: StatOption[];
};

export type MetaColumnsResponse = {
  categories: StatCategory[];
};

export type SeasonRow = {
  season: string;
  games: number;
  seriesPlayed: number;
  goals: number;
  assists: number;
  saves: number;
  demos: number;
};

export type SeasonResponse = {
  mode: "avg" | "total";
  rows: SeasonRow[];
};
