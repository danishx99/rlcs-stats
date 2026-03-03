export type StatOption = {
  key: string;
  label: string;
  format?: "int" | "float" | "pct";
};

export type TrackMode = "1s" | "2s" | "3s";
export type TrackScope = "regional" | "international";
export type TrackTier = "none" | "major" | "worlds";

export type MetaResponse = {
  generatedAt: string;
  modes: TrackMode[];
  scopes: TrackScope[];
  tiers: TrackTier[];
  seasons: string[];
  splits: string[];
  events: string[];
  internationalEvents?: string[];
  statOptions: StatOption[];
  featuredOptions?: StatOption[];
};

export type SeriesMetaResponse = {
  generatedAt: string;
  mode?: string | null;
  scope?: string | null;
  tier?: string | null;
  seasons: string[];
  splits: string[];
  events: string[];
  internationalEvents?: string[];
  stages: string[];
  teams: string[];
};

export type SeriesListRow = {
  seriesId: string;
  eventId: string | null;
  date: string | null;
  mode: string | null;
  scope: string | null;
  tier: string | null;
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
    mode?: string | null;
    scope?: string | null;
    tier?: string | null;
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
  twitter?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  twitch?: string | null;
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
      events?: {
        split: string | null;
        event: string | null;
        scope: string | null;
        tier: string | null;
        firstDate: string | null;
        lastDate: string | null;
      }[];
    }[];
  }[];
  debut: string | null;
  bestResult: string | null;
  games: number;
  seriesPlayed: number;
  totals: Record<string, number>;
  averages: Record<string, number>;
};

export type RosterEventResultRow = {
  eventId: string | null;
  season: string | null;
  split: string | null;
  event: string | null;
  scope: string | null;
  tier: string | null;
  stageReached: string | null;
  placement: string | null;
  opponent: string | null;
  playerWins: number;
  opponentWins: number;
  wonSeries: boolean;
  seriesPlayed: number;
  seriesWon: number;
  gamesPlayed: number;
  gamesWon: number;
  firstDate: string | null;
  lastDate: string | null;
  rosterId: string | null;
  rosterStarters: RosterStarter[];
};

export type RosterResultsResponse = {
  season: string;
  rows: RosterEventResultRow[];
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
  event: string | null;
  event_id?: string | null;
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
  event: string;
  eventId?: string | null;
  team?: string | null;
  mode?: string | null;
  scope?: string | null;
  tier?: string | null;
  placementStart: number | null;
  placementEnd: number | null;
  placement: string | null;
  series: PlayerResultSeries[];
};

export type PlayerResultsResponse = {
  seasons: string[];
  events: PlayerResultEvent[];
};

export type EventDetail = {
  id: string;
  name: string;
  season: string | null;
  split: string | null;
  mode: string | null;
  scope: string | null;
  tier: string | null;
  minDate: string | null;
  maxDate: string | null;
  totalSeries: number;
  totalPlayers: number;
};

export type EventTeam = {
  team: string;
  uniqueId?: string | null;
  photoUrl?: string | null;
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

export type TopQueryRow = {
  id: string;
  label: string;
  entityType: "player" | "match";
  team: string | null;
  value: number;
  valueDisplay: string;
  context: string | null;
  photoUrl: string | null;
};

export type TopQueryCategory = {
  key: string;
  title: string;
  subtitle: string;
  valueLabel: string;
  rows: TopQueryRow[];
};

export type InsightsResponse = {
  generatedAt: string;
  categories: TopQueryCategory[];
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
  resolvedAt: string | null;
  resolved: boolean;
  type: FeedbackType;
  message: string;
  page: FeedbackPageContext;
  client: Record<string, unknown> | null;
  server: Record<string, unknown> | null;
};

export type FeedbackListResponse = {
  rows: FeedbackListRow[];
};

export type FeedbackUpdateResponse = {
  ok: boolean;
  id: number;
  resolvedAt: string | null;
  resolved: boolean;
};
