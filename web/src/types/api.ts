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
  type: "player" | "roster" | "team" | "stat" | "event";
  meta?: {
    photoUrl?: string | null;
    country?: string | null;
    starters?: string[] | null;
    realName?: string | null;
    season?: string | null;
    split?: string | null;
  };
};

export type SearchResponse = {
  players: SearchResult[];
  teams: SearchResult[];
  rosters: SearchResult[];
  stats: SearchResult[];
  events: SearchResult[];
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
  logoUrl?: string | null;
  starters: RosterStarter[];
  alternates: RosterAlternate[];
  currentRoster?: RosterStarter[];
  currentAlternates?: RosterAlternate[];
  defaultSeason?: string | null;
  seasonsCompeted?: string[];
  otherTeamNames?: string[];
  seasonRosters?: {
    season: string;
    iterations: {
      rosterId: string;
      teamLabelUsed: string | null;
      seriesPlayed: number;
      firstSeenDate: string | null;
      lastSeenDate: string | null;
      alsoCompetedUnder?: string[];
      starters: RosterStarter[];
      alternates: RosterAlternate[];
    }[];
  }[];
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
  total: number;
  limit: number;
  offset: number;
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

export type StandingsRow = {
  rank: number;
  teamName: string;
  points: number;
  logoUrl?: string | null;
};

export type StandingsResponse = {
  seasons: string[];
  season: string;
  rows: StandingsRow[];
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

export type PlayerResultSeries = {
  seriesId: string;
  opponent: string;
  playerWins: number;
  opponentWins: number;
  bestOf: number;
  round: string | null;
  stage: string | null;
  wonSeries: boolean;
  date: string | null;
};

export type PlayerResultEvent = {
  season: string;
  split: string;
  regional: string;
  placement: string | null;
  series: PlayerResultSeries[];
};

export type PlayerResultsResponse = {
  seasons: string[];
  events: PlayerResultEvent[];
};

export type EventDetail = {
  name: string;
  season: string | null;
  split: string | null;
  minDate: string | null;
  maxDate: string | null;
  totalSeries: number;
  totalPlayers: number;
};

export type EventTeam = {
  team: string;
  deepRound: string | null;
  roundDepth: number;
  wonDeepest: boolean;
  placementStart: number;
  placementEnd: number;
  logoUrl: string | null;
};

export type EventBracket = {
  imageUrl: string;
  liquipediaUrl: string;
};

export type EventDetailResponse = {
  event: EventDetail;
  teams: EventTeam[];
  bracket: EventBracket | null;
  leaderboards: LeaderboardResponse[];
};

export type FeedbackType = "bug" | "idea" | "question";

export type FeedbackPageContext = {
  url: string;
  path: string;
  search?: string | null;
  hash?: string | null;
  title?: string | null;
};

export type FeedbackClientContext = {
  viewportWidth?: number | null;
  viewportHeight?: number | null;
  screenWidth?: number | null;
  screenHeight?: number | null;
  language?: string | null;
  timezone?: string | null;
  userAgent?: string | null;
  platform?: string | null;
  referrer?: string | null;
  submittedAt?: string | null;
  sessionId?: string | null;
};

export type FeedbackSubmitRequest = {
  type: FeedbackType;
  message: string;
  page: FeedbackPageContext;
  client: FeedbackClientContext;
};

export type FeedbackSubmitResponse = {
  ok: boolean;
  id: number;
};

export type FeedbackListRow = {
  id: number;
  createdAt: string;
  type: FeedbackType;
  message: string;
  page: FeedbackPageContext;
  client: Record<string, unknown> | null;
  server: Record<string, unknown> | null;
};

export type FeedbackListResponse = {
  rows: FeedbackListRow[];
};
