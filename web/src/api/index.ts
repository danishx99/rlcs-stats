import type {
  CompareHistoryResponse,
  CompareResponse,
  EventDetailResponse,
  FeedbackSubmitRequest,
  FeedbackSubmitResponse,
  FeaturedResponse,
  LeaderboardResponse,
  MetaColumnsResponse,
  MetaResponse,
  PlayerProfile,
  PlayerResultsResponse,
  SeriesDetailResponse,
  SeriesListResponse,
  SeriesMetaResponse,
  RosterProfile,
  SearchResponse,
  SeasonResponse,
  StandingsResponse
} from "../types/api";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";
const API_TIMEOUT_MS = Number.parseInt(import.meta.env.VITE_API_TIMEOUT_MS || "15000", 10);

function resolveApiPath(path: string) {
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

export async function fetchJson<T>(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>
) {
  const url = new URL(resolveApiPath(path), window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "ngrok-skip-browser-warning": "1" },
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
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

export async function postJson<TResponse>(path: string, body: unknown) {
  const url = new URL(resolveApiPath(path), window.location.origin);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "1"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
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

  return (await response.json()) as TResponse;
}

export const api = {
  meta(params?: Record<string, string | number | boolean | null | undefined>) {
    return fetchJson<MetaResponse>("/api/meta", params);
  },
  seriesMeta(params?: Record<string, string | number | boolean | null | undefined>) {
    return fetchJson<SeriesMetaResponse>("/api/series/meta", params);
  },
  seriesList(params?: Record<string, string | number | boolean | null | undefined>) {
    return fetchJson<SeriesListResponse>("/api/series", params);
  },
  seriesDetail(seriesId: string) {
    return fetchJson<SeriesDetailResponse>(`/api/series/${encodeURIComponent(seriesId)}`);
  },
  search(params?: Record<string, string | number | boolean | null | undefined>) {
    return fetchJson<SearchResponse>("/api/search", params);
  },
  players(params?: Record<string, string | number | boolean | null | undefined>) {
    return fetchJson<{ players: SearchResponse["players"] }>("/api/players", params);
  },
  playerProfile(id: string, params?: Record<string, string | number | boolean | null | undefined>) {
    return fetchJson<{ player: PlayerProfile }>(`/api/players/${id}`, params);
  },
  playerSeason(id: string, params?: Record<string, string | number | boolean | null | undefined>) {
    return fetchJson<SeasonResponse>(`/api/players/${id}/season`, params);
  },
  playerResults(id: string, params?: Record<string, string | number | boolean | null | undefined>) {
    return fetchJson<PlayerResultsResponse>(`/api/players/${id}/results`, params);
  },
  rosterProfile(id: string, params?: Record<string, string | number | boolean | null | undefined>) {
    return fetchJson<{ roster: RosterProfile }>(`/api/rosters/${id}`, params);
  },
  rosterSeason(id: string, params?: Record<string, string | number | boolean | null | undefined>) {
    return fetchJson<SeasonResponse>(`/api/rosters/${id}/season`, params);
  },
  compare(params?: Record<string, string | number | boolean | null | undefined>) {
    return fetchJson<CompareResponse>("/api/compare", params);
  },
  compareHistory(params?: Record<string, string | number | boolean | null | undefined>) {
    return fetchJson<CompareHistoryResponse>("/api/compare/history", params);
  },
  statsTop(params?: Record<string, string | number | boolean | null | undefined>) {
    return fetchJson<LeaderboardResponse>("/api/stats/top", params);
  },
  featured(params?: Record<string, string | number | boolean | null | undefined>) {
    return fetchJson<FeaturedResponse>("/api/featured", params);
  },
  metaColumns() {
    return fetchJson<MetaColumnsResponse>("/api/meta/columns");
  },
  standings(params?: Record<string, string | number | boolean | null | undefined>) {
    return fetchJson<StandingsResponse>("/api/standings", params);
  },
  eventDetail(eventName: string, params?: Record<string, string | number | boolean | null | undefined>) {
    return fetchJson<EventDetailResponse>(`/api/events/${encodeURIComponent(eventName)}`, params);
  },
  submitFeedback(payload: FeedbackSubmitRequest) {
    return postJson<FeedbackSubmitResponse>("/api/feedback", payload);
  }
};
