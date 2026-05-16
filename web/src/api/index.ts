import type {
  CompareHistoryResponse,
  CompareResponse,
  EventDetailResponse,
  InsightsResponse,
  FeedbackListResponse,
  FeedbackSubmitRequest,
  FeedbackSubmitResponse,
  FeedbackUpdateResponse,
  FeaturedResponse,
  LeaderboardResponse,
  MetaColumnsResponse,
  MetaResponse,
  PlayerProfile,
  PlayerResultsResponse,
  RosterResultsResponse,
  SeriesDetailResponse,
  SeriesListResponse,
  SeriesMetaResponse,
  RosterProfile,
  SearchResponse,
  SeasonResponse,
  StandingsResponse
} from "../types/api";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";
const API_TIMEOUT_MS = Number.parseInt(import.meta.env.VITE_API_TIMEOUT_MS || "30000", 10);

export function resolveApiPath(path: string) {
  const base = API_URL.trim();
  if (!base) return path;

  if (base.startsWith("http://") || base.startsWith("https://")) {
    return new URL(path, base).toString();
  }

  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  if (normalizedBase.endsWith("/api") && path.startsWith("/api/")) {
    return `${normalizedBase}${path.slice(4)}`;
  }

  return `${normalizedBase}${path}`;
}

async function parseApiError(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // Ignore JSON parse errors and fall back to status-only error.
  }
  return null;
}

type QueryParams = Record<string, string | number | boolean | null | undefined>;

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  params?: QueryParams;
  signal?: AbortSignal;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params, signal } = options;
  const url = new URL(resolveApiPath(path), window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const headers: Record<string, string> = { "ngrok-skip-browser-warning": "1" };
  const init: RequestInit = { method, headers, signal: controller.signal };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      if (signal?.aborted) throw error;
      throw new Error(`API request timed out after ${API_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    const apiError = await parseApiError(response);
    throw new Error(apiError ? `API error ${response.status}: ${apiError}` : `API error ${response.status}`);
  }

  return (await response.json()) as T;
}

export function fetchJson<T>(
  path: string,
  params?: QueryParams,
  options?: { signal?: AbortSignal }
) {
  return request<T>(path, { params, signal: options?.signal });
}

export function postJson<TResponse>(path: string, body: unknown, options?: { signal?: AbortSignal }) {
  return request<TResponse>(path, { method: "POST", body, signal: options?.signal });
}

export function patchJson<TResponse>(path: string, body: unknown, options?: { signal?: AbortSignal }) {
  return request<TResponse>(path, { method: "PATCH", body, signal: options?.signal });
}

// --- Shared param shapes ----------------------------------------------------

// Every server route that uses buildFilterClauses accepts this same set of
// optional filter keys. Server-side names live in
// server/src/utils/filters.ts::FILTER_COLUMNS — keep these in sync.
// Nullable strings collapse to "drop the param" inside `request()` (alongside
// undefined and empty string). Keeping `null` in the union lets call sites
// pass through `someState ?? null` without extra coalescing dance.
type Nullable<T> = T | null | undefined;

export type StatsFilterParams = {
  season?: Nullable<string>;
  split?: Nullable<string>;
  event?: Nullable<string>;
  gameMode?: Nullable<string>;
  scope?: Nullable<string>;
  tier?: Nullable<string>;
};

export type StatsMode = "avg" | "total";

// --- Per-endpoint param interfaces ------------------------------------------

export type MetaParams = StatsFilterParams;

export type SeriesMetaParams = StatsFilterParams & {
  includeLans?: string;
  stage?: string;
};

export type SeriesListParams = SeriesMetaParams & {
  team?: string;
  team2?: string;
};

export type SearchParams = StatsFilterParams & {
  q: string;
  limit?: number;
};

export type PlayersListParams = StatsFilterParams & {
  limit?: number;
  offset?: number;
};

export type PlayerProfileParams = StatsFilterParams;

export type PlayerSeasonParams = StatsFilterParams & {
  mode?: StatsMode;
};

export type PlayerResultsParams = StatsFilterParams & {
  season?: string;
};

export type RosterProfileParams = StatsFilterParams;

export type RosterSeasonParams = StatsFilterParams & {
  mode?: StatsMode;
};

export type RosterResultsParams = StatsFilterParams & {
  season: string;
};

export type CompareParams = StatsFilterParams & {
  type?: "players" | "rosters" | "teams";
  ids: string;
  metrics?: string;
  mode?: StatsMode;
};

export type CompareHistoryParams = StatsFilterParams & {
  type?: "players" | "rosters";
  ids: string;
  limit?: number;
  offset?: number;
};

export type StatsTopParams = StatsFilterParams & {
  metric: string;
  mode?: StatsMode;
  type?: "player" | "team";
  sort?: "asc" | "desc";
  limit?: number;
  phase?: string;
  day?: string;
  ssaOnly?: string;
  arena?: string;
  minSeries?: number;
  minGames?: number;
};

export type FeaturedParams = StatsFilterParams & {
  metric?: string;
  limit?: number;
};

export type InsightsParams = StatsFilterParams & {
  limit?: number;
};

export type StandingsParams = {
  season?: Nullable<string>;
};

export type EventDetailParams = {
  teamsLimit?: number;
  mode?: StatsMode;
  phase?: string;
  day?: string;
  arena?: string;
};

export type FeedbackListParams = {
  type?: "bug" | "idea" | "question";
  resolved?: "resolved" | "unresolved" | "all";
};

export const api = {
  meta(params?: MetaParams) {
    return fetchJson<MetaResponse>("/api/meta", params);
  },
  seriesMeta(params?: SeriesMetaParams) {
    return fetchJson<SeriesMetaResponse>("/api/series/meta", params);
  },
  seriesList(params?: SeriesListParams) {
    return fetchJson<SeriesListResponse>("/api/series", params);
  },
  seriesDetail(seriesId: string) {
    return fetchJson<SeriesDetailResponse>(`/api/series/${encodeURIComponent(seriesId)}`);
  },
  search(params: SearchParams, options?: { signal?: AbortSignal }) {
    return fetchJson<SearchResponse>("/api/search", params, options);
  },
  players(params?: PlayersListParams) {
    return fetchJson<{ players: SearchResponse["players"] }>("/api/players", params);
  },
  playerProfile(
    id: string,
    params?: PlayerProfileParams,
    options?: { spotlight?: string[] }
  ) {
    const merged: QueryParams = { ...(params ?? {}) };
    const spotlight = options?.spotlight?.filter((key) => key && key.trim().length) ?? [];
    if (spotlight.length) {
      merged.spotlight = spotlight.join(",");
    }
    return fetchJson<{ player: PlayerProfile }>(`/api/players/${id}`, merged);
  },
  playerSeason(id: string, params?: PlayerSeasonParams) {
    return fetchJson<SeasonResponse>(`/api/players/${id}/season`, params);
  },
  playerResults(id: string, params?: PlayerResultsParams) {
    return fetchJson<PlayerResultsResponse>(`/api/players/${id}/results`, params);
  },
  rosterProfile(id: string, params?: RosterProfileParams) {
    return fetchJson<{ roster: RosterProfile }>(`/api/rosters/${id}`, params);
  },
  rosterSeason(id: string, params?: RosterSeasonParams) {
    return fetchJson<SeasonResponse>(`/api/rosters/${id}/season`, params);
  },
  rosterResults(id: string, params: RosterResultsParams) {
    return fetchJson<RosterResultsResponse>(`/api/rosters/${id}/results`, params);
  },
  compare(params: CompareParams) {
    return fetchJson<CompareResponse>("/api/compare", params);
  },
  compareHistory(params: CompareHistoryParams) {
    return fetchJson<CompareHistoryResponse>("/api/compare/history", params);
  },
  statsTop(params: StatsTopParams) {
    return fetchJson<LeaderboardResponse>("/api/stats/top", params);
  },
  featured(params?: FeaturedParams) {
    return fetchJson<FeaturedResponse>("/api/featured", params);
  },
  metaColumns() {
    return fetchJson<MetaColumnsResponse>("/api/meta/columns");
  },
  standings(params?: StandingsParams) {
    return fetchJson<StandingsResponse>("/api/standings", params);
  },
  eventDetail(eventId: string, params?: EventDetailParams) {
    return fetchJson<EventDetailResponse>(`/api/events/${encodeURIComponent(eventId)}`, params);
  },
  insights(params?: InsightsParams) {
    return fetchJson<InsightsResponse>("/api/insights", params);
  },
  submitFeedback(payload: FeedbackSubmitRequest) {
    return postJson<FeedbackSubmitResponse>("/api/feedback", payload);
  },
  feedback(params?: FeedbackListParams) {
    return fetchJson<FeedbackListResponse>("/api/feedback", params);
  },
  updateFeedback(id: number, payload: { resolved: boolean }) {
    return patchJson<FeedbackUpdateResponse>(`/api/feedback/${id}`, payload);
  }
};
