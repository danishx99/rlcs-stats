import { useEffect, useMemo, useState } from "react";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

type StatOption = {
  key: string;
  label: string;
  format?: "int" | "float" | "pct";
};

type MetaResponse = {
  generatedAt: string;
  seasons: string[];
  splits: string[];
  events: string[];
  statOptions: StatOption[];
};

type SearchResult = {
  id: string;
  label: string;
  type: "player" | "team" | "stat";
  meta?: {
    photoUrl?: string | null;
    country?: string | null;
  };
};

type PlayerCard = {
  id: string;
  label: string;
  aliases?: string | null;
  country?: string | null;
  photoUrl?: string | null;
  teams: string[];
  games: number;
};

type PlayerProfile = {
  id: string;
  handle: string | null;
  playerName: string | null;
  aliases: string | null;
  realName: string | null;
  country: string | null;
  photoUrl: string | null;
  dateOfBirth: string | null;
  debutDate: string | null;
  bestResult: string | null;
  twitch?: string | null;
  tiktok?: string | null;
  teams: string[];
  games: number;
  seriesPlayed: number;
  totals: Record<string, number>;
  averages: Record<string, number>;
};

type CompareMetric = {
  key: string;
  label: string;
};

type CompareRow = {
  id: string;
  label: string;
  teams?: string[];
  games: number;
  values: Record<string, number>;
};

type CompareResponse = {
  mode: "avg" | "total";
  metrics: CompareMetric[];
  rows: CompareRow[];
};

type LeaderboardRow = {
  id: string;
  label: string;
  teams: string[];
  photoUrl?: string | null;
  country?: string | null;
  value: number;
};

type LeaderboardResponse = {
  mode: "avg" | "total";
  metric: StatOption;
  rows: LeaderboardRow[];
};

type FeaturedResponse = {
  mode: "avg" | "total";
  metric: StatOption;
  rows: LeaderboardRow[];
};

type SeasonRow = {
  season: string;
  games: number;
  seriesPlayed: number;
  goals: number;
  assists: number;
  saves: number;
  demos: number;
};

type SeasonResponse = {
  mode: "avg" | "total";
  rows: SeasonRow[];
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

const DEFAULT_COMPARE_STATS = ["goals", "assists", "saves", "demos"];

async function fetchJson<T>(path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(`${API_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === "" || value === null) return;
      url.searchParams.set(key, String(value));
    });
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
  return (await response.json()) as T;
}

function formatValue(value: number | null | undefined, format?: StatOption["format"]) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  if (format === "pct") {
    return `${percentFormatter.format(value)}%`;
  }
  if (format === "float") {
    return decimalFormatter.format(value);
  }
  return numberFormatter.format(value);
}

function formatStat(
  value: number | null | undefined,
  format: StatOption["format"] | undefined,
  mode: "avg" | "total"
) {
  if (format === "pct") {
    return formatValue(value, "pct");
  }
  if (format === "int") {
    return formatValue(value, "int");
  }
  if (mode === "avg") {
    return formatValue(value, "float");
  }
  return formatValue(value, format);
}

function buildSeasonSummaryRow(profile: PlayerProfile): SeasonRow {
  return {
    season: "All seasons",
    games: profile.games,
    seriesPlayed: profile.seriesPlayed,
    goals: profile.averages.goals,
    assists: profile.averages.assists,
    saves: profile.averages.saves,
    demos: profile.averages.demos
  };
}

function normalizeHandle(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function normalizeSocialLink(value: string | null | undefined, type: "twitch" | "tiktok") {
  const handle = normalizeHandle(value);
  if (!handle) return null;
  if (handle.startsWith("http://") || handle.startsWith("https://")) {
    return handle;
  }
  const cleaned = handle.replace(/^@/, "");
  if (type === "twitch") {
    return `https://twitch.tv/${cleaned}`;
  }
  if (type === "tiktok") {
    return `https://www.tiktok.com/@${cleaned}`;
  }
  return null;
}

function proxyImageUrl(value?: string | null) {
  const url = normalizeHandle(value);
  if (!url) return null;
  return `${API_URL}/api/image?url=${encodeURIComponent(url)}`;
}

function TwitchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 3h16v9.7l-4.6 4.6h-3l-2.6 2.7v-2.7H7.2L4 14V3zm2.7 2.7v7.5h3v2.1l2.1-2.1h3.5l2.7-2.7V5.7H6.7zm4.6 2.1h1.6v4.3h-1.6V7.8zm3.8 0h1.6v4.3h-1.6V7.8z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15.5 3c.3 2.2 1.7 3.8 3.8 4.1v2.9c-1.5.1-2.9-.4-3.8-1.2v6.4c0 3-2.4 5.4-5.4 5.4S4.7 18.2 4.7 15.2s2.4-5.4 5.4-5.4c.4 0 .8 0 1.2.1v3c-.4-.2-.8-.3-1.2-.3-1.3 0-2.4 1.1-2.4 2.4s1.1 2.4 2.4 2.4 2.4-1.1 2.4-2.4V3h2.8z" />
    </svg>
  );
}
function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function computeAge(value?: string | null) {
  if (!value) return "—";
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return Number.isFinite(age) && age > 0 ? `${age}` : "—";
}

function formatAliases(value?: string | null) {
  if (!value) return null;
  const seen = new Set<string>();
  const trimmed = value
    .split(",")
    .map((alias) => alias.trim())
    .filter(Boolean)
    .filter((alias) => {
      if (seen.has(alias)) return false;
      seen.add(alias);
      return true;
    })
    .join(", ");
  return trimmed.length ? trimmed : null;
}

function Dashboard() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<SearchResult["type"]>("player");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [filters, setFilters] = useState({ season: "", split: "", event: "" });
  const [compareMode, setCompareMode] = useState<"players" | "teams">("players");
  const [compareSelection, setCompareSelection] = useState<SearchResult[]>([]);
  const [compareMetrics, setCompareMetrics] = useState<string[]>(DEFAULT_COMPARE_STATS);
  const [compareResults, setCompareResults] = useState<CompareResponse | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [leaderStat, setLeaderStat] = useState<string>("score");
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [leaderLoading, setLeaderLoading] = useState(false);
  const [featuredStat, setFeaturedStat] = useState<string>("score");
  const [featured, setFeatured] = useState<FeaturedResponse | null>(null);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [playerCards, setPlayerCards] = useState<PlayerCard[]>([]);
  const [playerCardsLoading, setPlayerCardsLoading] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [playerProfileLoading, setPlayerProfileLoading] = useState(false);
  const [seasonRows, setSeasonRows] = useState<SeasonRow[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);

  const statMap = useMemo(() => {
    return new Map(meta?.statOptions.map((option) => [option.key, option]) ?? []);
  }, [meta]);

  const seasonTableRows = useMemo(() => {
    if (filters.season) {
      return seasonRows;
    }
    if (!playerProfile) {
      return [];
    }
    return [buildSeasonSummaryRow(playerProfile)];
  }, [filters.season, playerProfile, seasonRows]);

  const filterParams = useMemo(() => {
    return {
      season: filters.season || undefined,
      split: filters.split || undefined,
      event: filters.event || undefined
    };
  }, [filters]);

  useEffect(() => {
    let ignore = false;
    async function loadMeta() {
      try {
        const response = await fetchJson<MetaResponse>("/api/meta", {
          season: filters.season || undefined,
          split: filters.split || undefined
        });
        if (!ignore) {
          setMeta(response);
          setMetaError(null);
        }
      } catch (error) {
        if (!ignore) {
          setMetaError(error instanceof Error ? error.message : "Failed to load metadata");
        }
      }
    }

    loadMeta();
    return () => {
      ignore = true;
    };
  }, [filters.season, filters.split]);

  useEffect(() => {
    if (!meta) return;
    const defaultStat = meta.statOptions.find((option) => option.key === "score")?.key;
    const fallback = defaultStat ?? meta.statOptions[0]?.key;
    if (!fallback) return;
    setLeaderStat((prev) => {
      if (prev && meta.statOptions.some((option) => option.key === prev)) {
        return prev;
      }
      return fallback;
    });
    setFeaturedStat((prev) => {
      if (prev && meta.statOptions.some((option) => option.key === prev)) {
        return prev;
      }
      return fallback;
    });
  }, [meta]);

  useEffect(() => {
    setCompareSelection([]);
  }, [compareMode]);

  useEffect(() => {
    let ignore = false;
    const trimmed = searchQuery.trim();
    if (!trimmed && searchType !== "stat") {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const response = await fetchJson<{ results: SearchResult[] }>("/api/search", {
          type: searchType === "stat" ? "stats" : searchType === "team" ? "teams" : "players",
          q: trimmed,
          limit: 8
        });
        if (!ignore) {
          setSearchResults(response.results ?? []);
        }
      } catch (error) {
        if (!ignore) {
          setSearchResults([]);
        }
      } finally {
        if (!ignore) {
          setSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      ignore = true;
      window.clearTimeout(handle);
    };
  }, [searchQuery, searchType]);

  useEffect(() => {
    let ignore = false;
    async function loadPlayers() {
      try {
        setPlayerCardsLoading(true);
        const response = await fetchJson<{ players: PlayerCard[] }>("/api/players", {
          ...filterParams,
          limit: 12
        });
        if (!ignore) {
          setPlayerCards(response.players ?? []);
          if (!selectedPlayerId && response.players?.length) {
            setSelectedPlayerId(response.players[0].id);
          }
        }
      } catch (error) {
        if (!ignore) {
          setPlayerCards([]);
        }
      } finally {
        if (!ignore) {
          setPlayerCardsLoading(false);
        }
      }
    }

    loadPlayers();
    return () => {
      ignore = true;
    };
  }, [filterParams]);

  useEffect(() => {
    if (!selectedPlayerId) {
      setPlayerProfile(null);
      return;
    }
    let ignore = false;
    async function loadProfile() {
      try {
        setPlayerProfileLoading(true);
        const response = await fetchJson<{ player: PlayerProfile }>(`/api/players/${selectedPlayerId}`,
          filterParams
        );
        if (!ignore) {
          setPlayerProfile(response.player);
        }
      } catch (error) {
        if (!ignore) {
          setPlayerProfile(null);
        }
      } finally {
        if (!ignore) {
          setPlayerProfileLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      ignore = true;
    };
  }, [selectedPlayerId, filterParams]);

  useEffect(() => {
    if (!selectedPlayerId) {
      setSeasonRows([]);
      return;
    }
    let ignore = false;
    async function loadSeason() {
      try {
        setSeasonLoading(true);
        const response = await fetchJson<SeasonResponse>(
          `/api/players/${selectedPlayerId}/season`,
          { ...filterParams, mode: "avg" }
        );
        if (!ignore) {
          setSeasonRows(response.rows ?? []);
        }
      } catch (error) {
        if (!ignore) {
          setSeasonRows([]);
        }
      } finally {
        if (!ignore) {
          setSeasonLoading(false);
        }
      }
    }

    loadSeason();
    return () => {
      ignore = true;
    };
  }, [selectedPlayerId, filterParams]);

  useEffect(() => {
    let ignore = false;
    async function loadCompare() {
      if (compareSelection.length < 2 || !compareMetrics.length) {
        setCompareResults(null);
        return;
      }
      try {
        setCompareLoading(true);
        const response = await fetchJson<CompareResponse>("/api/compare", {
          type: compareMode,
          ids: compareSelection.map((item) => item.id).join(","),
          metrics: compareMetrics.join(","),
          mode: "avg",
          ...filterParams
        });
        if (!ignore) {
          setCompareResults(response);
        }
      } catch (error) {
        if (!ignore) {
          setCompareResults(null);
        }
      } finally {
        if (!ignore) {
          setCompareLoading(false);
        }
      }
    }

    loadCompare();
    return () => {
      ignore = true;
    };
  }, [compareSelection, compareMetrics, compareMode, filterParams]);

  useEffect(() => {
    let ignore = false;
    async function loadLeaderboard() {
      if (!leaderStat) return;
      try {
        setLeaderLoading(true);
        const response = await fetchJson<LeaderboardResponse>("/api/stats/top", {
          metric: leaderStat,
          mode: "avg",
          limit: 10,
          ...filterParams
        });
        if (!ignore) {
          setLeaderboard(response);
        }
      } catch (error) {
        if (!ignore) {
          setLeaderboard(null);
        }
      } finally {
        if (!ignore) {
          setLeaderLoading(false);
        }
      }
    }

    loadLeaderboard();
    return () => {
      ignore = true;
    };
  }, [leaderStat, filterParams]);

  useEffect(() => {
    let ignore = false;
    async function loadFeatured() {
      if (!featuredStat) return;
      try {
        setFeaturedLoading(true);
        const response = await fetchJson<FeaturedResponse>("/api/featured", {
          metric: featuredStat,
          mode: "avg",
          limit: 6,
          ...filterParams
        });
        if (!ignore) {
          setFeatured(response);
        }
      } catch (error) {
        if (!ignore) {
          setFeatured(null);
        }
      } finally {
        if (!ignore) {
          setFeaturedLoading(false);
        }
      }
    }

    loadFeatured();
    return () => {
      ignore = true;
    };
  }, [featuredStat, filterParams]);

  const addCompareSelection = (item: SearchResult) => {
    if (compareSelection.find((entry) => entry.id === item.id)) return;
    if (compareSelection.length >= 6) return;
    setCompareSelection((prev) => [...prev, item]);
  };

  const removeCompareSelection = (id: string) => {
    setCompareSelection((prev) => prev.filter((entry) => entry.id !== id));
  };

  const toggleCompareMetric = (key: string) => {
    setCompareMetrics((prev) => {
      if (prev.includes(key)) {
        return prev.filter((item) => item !== key);
      }
      return [...prev, key];
    });
  };

  const statOptions = meta?.statOptions ?? [];
  const compareStatsList = statOptions.filter((option) => option.key !== "series_played");

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">RLCS Intel Grid</p>
          <h1>RLCS Stats Command</h1>
          <p className="lede">
            Industrial-grade scouting dashboards for SSA 21/22 + 22/23. Search players,
            compare rosters, and surface stat leaders with precision filtering.
          </p>
        </div>
      </header>

      {metaError && <div className="error-banner">{metaError}</div>}

      <section className="control-row">
        <div className="panel search-panel" style={{ animationDelay: "80ms" }}>
          <div className="panel-header">
            <div>
              <p className="panel-label">Global Search</p>
              <h2>Players · Teams · Stats</h2>
            </div>
            <div className="tabs">
              {([
                { key: "player", label: "Players" },
                { key: "team", label: "Teams" },
                { key: "stat", label: "Stats" }
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={searchType === tab.key ? "tab active" : "tab"}
                  onClick={() => setSearchType(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="search-input">
            <input
              type="search"
              placeholder="Search handle, team, or stat"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <span className="search-status">{searchLoading ? "Scanning" : "Ready"}</span>
          </div>
          <div className="search-results">
            {searchResults.length === 0 ? (
              <p className="empty">No matches yet. Try a new query.</p>
            ) : (
              <ul>
                {searchResults.map((result) => (
                  <li key={`${result.type}-${result.id}`}>
                    <div className="result-main">
                      <div>
                        <strong>{result.label}</strong>
                        {result.meta?.country && <span>{result.meta.country}</span>}
                      </div>
                    </div>
                    <div className="result-actions">
                      {result.type === "player" && (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => navigate(`/uniqueid/${encodeURIComponent(result.id)}`)}
                        >
                          View
                        </button>
                      )}
                      {(result.type === "player" || result.type === "team") &&
                        (compareMode === (result.type === "player" ? "players" : "teams") && (
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => addCompareSelection(result)}
                          >
                            Compare
                          </button>
                        ))}
                      {result.type === "stat" && (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => setLeaderStat(result.id)}
                        >
                          Use Stat
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="panel filter-panel" style={{ animationDelay: "140ms" }}>
          <div className="panel-header">
            <div>
              <p className="panel-label">Scope Filters</p>
              <h2>Season / Split / Event</h2>
            </div>
          </div>
          <div className="filters">
            <label>
              Season
              <select
                value={filters.season}
                onChange={(event) =>
                  setFilters({
                    season: event.target.value,
                    split: "",
                    event: ""
                  })
                }
              >
                <option value="">All</option>
                {(meta?.seasons ?? []).map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Split
              <select
                value={filters.split}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    split: event.target.value,
                    event: ""
                  }))
                }
                disabled={!filters.season}
              >
                <option value="">All</option>
                {(meta?.splits ?? []).map((split) => (
                  <option key={split} value={split}>
                    {split}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Event
              <select
                value={filters.event}
                onChange={(event) => setFilters((prev) => ({ ...prev, event: event.target.value }))}
                disabled={!filters.season || !filters.split}
              >
                <option value="">All</option>
                {(meta?.events ?? []).map((event) => (
                  <option key={event} value={event}>
                    {event}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="panel mode-panel" style={{ animationDelay: "200ms" }}>
          <div className="panel-header">
            <div>
              <p className="panel-label">Compare Mode</p>
              <h2>Players vs Teams</h2>
            </div>
          </div>
          <div className="toggle-row">
            <span>Focus</span>
            <div className="toggle">
              <button
                type="button"
                className={compareMode === "players" ? "active" : ""}
                onClick={() => setCompareMode("players")}
              >
                Players
              </button>
              <button
                type="button"
                className={compareMode === "teams" ? "active" : ""}
                onClick={() => setCompareMode("teams")}
              >
                Teams
              </button>
            </div>
          </div>
          <div className="compare-chips">
            {compareSelection.length === 0 ? (
              <p className="empty">Add 2-6 entries from search or player list.</p>
            ) : (
              compareSelection.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="chip"
                  onClick={() => removeCompareSelection(entry.id)}
                >
                  {entry.label}
                  <span>×</span>
                </button>
              ))
            )}
          </div>
          <div className="compare-stats">
            {compareStatsList.map((option) => (
              <label key={option.key} className="stat-toggle">
                <input
                  type="checkbox"
                  checked={compareMetrics.includes(option.key)}
                  onChange={() => toggleCompareMetric(option.key)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      </section>

      <main className="main-grid">
        <section className="panel compare-panel" style={{ animationDelay: "240ms" }}>
          <div className="panel-header">
            <div>
              <p className="panel-label">Split View</p>
              <h2>Head-to-Head Comparison</h2>
            </div>
            <span className="panel-tag">
              {compareMode === "players" ? "Players" : "Teams"}
            </span>
          </div>
          {compareLoading && <p className="empty">Computing matchup...</p>}
          {!compareLoading && (!compareResults || compareResults.rows.length === 0) && (
            <p className="empty">Select at least two entries to compare.</p>
          )}
          {compareResults && compareResults.rows.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Games</th>
                    {compareResults.metrics.map((metric) => (
                      <th key={metric.key}>{metric.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareResults.rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="cell-title">
                          <strong>{row.label}</strong>
                          {row.teams?.length ? (
                            <span>{row.teams.join(" / ")}</span>
                          ) : null}
                        </div>
                      </td>
                      <td>{formatValue(row.games)}</td>
                      {compareResults.metrics.map((metric) => (
                        <td key={metric.key}>
                          {formatStat(
                            row.values[metric.key],
                            statMap.get(metric.key)?.format,
                            compareResults.mode
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel leaderboard-panel" style={{ animationDelay: "280ms" }}>
          <div className="panel-header">
            <div>
              <p className="panel-label">Top 10</p>
              <h2>Leaderboard</h2>
            </div>
            <select
              value={leaderStat}
              onChange={(event) => setLeaderStat(event.target.value)}
            >
              {statOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {leaderLoading && <p className="empty">Loading leaderboard...</p>}
          {!leaderLoading && leaderboard?.rows?.length ? (
            <ol className="rank-list">
              {leaderboard.rows.map((row, index) => (
                <li key={row.id}>
                  <span className="rank">{index + 1}</span>
                  <div>
                    <strong>{row.label}</strong>
                    <span>{row.teams.join(" / ")}</span>
                  </div>
                  <em>{formatStat(row.value, leaderboard.metric.format, leaderboard.mode)}</em>
                </li>
              ))}
            </ol>
          ) : (
            !leaderLoading && <p className="empty">No leaderboard data.</p>
          )}
        </section>

        <section className="panel featured-panel" style={{ animationDelay: "320ms" }}>
          <div className="panel-header">
            <div>
              <p className="panel-label">Featured Players</p>
              <h2>Top Performers</h2>
            </div>
            <select
              value={featuredStat}
              onChange={(event) => setFeaturedStat(event.target.value)}
            >
              {statOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {featuredLoading && <p className="empty">Loading featured players...</p>}
          {!featuredLoading && featured?.rows?.length ? (
            <div className="featured-grid">
              {featured.rows.map((row) => (
                <article key={row.id} className="featured-card">
                  <div className="avatar">
                    {row.photoUrl ? (
                      <img src={proxyImageUrl(row.photoUrl) ?? undefined} alt={row.label} />
                    ) : (
                      <span>{row.label.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <h3>{row.label}</h3>
                    <p>{row.teams.join(" / ")}</p>
                    <strong>{formatStat(row.value, featured.metric.format, featured.mode)}</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            !featuredLoading && <p className="empty">No featured data.</p>
          )}
        </section>

        <section className="panel teams-panel" style={{ animationDelay: "360ms" }}>
          <div className="panel-header">
            <div>
              <p className="panel-label">Teams Panel</p>
              <h2>Top 8 (Placeholder)</h2>
            </div>
          </div>
          <div className="teams-grid">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={`team-${index}`} className="team-card">
                <span>Rank {index + 1}</span>
                <strong>Team Slot</strong>
                <p>Points data coming soon</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel players-panel" style={{ animationDelay: "400ms" }}>
          <div className="panel-header">
            <div>
              <p className="panel-label">Player Profiles</p>
              <h2>Roster Intelligence</h2>
            </div>
          </div>
          <div className="players-layout">
            <div className="player-list">
              {playerCardsLoading ? (
                <p className="empty">Loading players...</p>
              ) : (
                playerCards.map((player) => (
                  <div
                    key={player.id}
                    className={
                      selectedPlayerId === player.id ? "player-card active" : "player-card"
                    }
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedPlayerId(player.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        setSelectedPlayerId(player.id);
                      }
                    }}
                  >
                    <div className="player-card-main">
                      <div className="avatar small">
                        {player.photoUrl ? (
                          <img src={proxyImageUrl(player.photoUrl) ?? undefined} alt={player.label} />
                        ) : (
                          <span>{player.label.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <strong>{player.label}</strong>
                        <span>{player.teams.join(" / ")}</span>
                      </div>
                    </div>
                    <em>{formatValue(player.games)}</em>
                    {compareMode === "players" && (
                      <button
                        type="button"
                        className="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          addCompareSelection({
                            id: player.id,
                            label: player.label,
                            type: "player"
                          });
                        }}
                      >
                        Compare
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="player-profile">
              {playerProfileLoading && <p className="empty">Loading profile...</p>}
              {!playerProfileLoading && !playerProfile && (
                <p className="empty">Select a player to view their profile.</p>
              )}
              {playerProfile && (
                <>
                  <div className="profile-header">
                    <div className="avatar large">
                      {playerProfile.photoUrl ? (
                        <img
                          src={proxyImageUrl(playerProfile.photoUrl) ?? undefined}
                          alt={playerProfile.handle ?? "Player"}
                        />
                      ) : (
                        <span>
                          {(playerProfile.handle ?? playerProfile.playerName ?? "?")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      {(() => {
                        const aliases = formatAliases(playerProfile.aliases);
                        return (
                          <>
                            <h3>{playerProfile.handle ?? playerProfile.playerName ?? "Unknown"}</h3>
                            {playerProfile.realName && (
                              <div className="profile-line">
                                <span>Real name</span>
                                <strong>{playerProfile.realName}</strong>
                              </div>
                            )}
                            {aliases && (
                              <div className="profile-line">
                                <span>Aliases</span>
                                <strong>{aliases}</strong>
                              </div>
                            )}
                          </>
                        );
                      })()}
                      <div className="profile-meta">
                        <div>
                          <span>Country</span>
                          <strong>{playerProfile.country ?? "—"}</strong>
                        </div>
                        <div>
                          <span>Date of Birth</span>
                          <strong>{formatDate(playerProfile.dateOfBirth)}</strong>
                        </div>
                        <div>
                          <span>Age</span>
                          <strong>{computeAge(playerProfile.dateOfBirth)}</strong>
                        </div>
                        <div>
                          <span>Debut</span>
                          <strong>{formatDate(playerProfile.debutDate)}</strong>
                        </div>
                        <div>
                          <span>Best Result</span>
                          <strong>{playerProfile.bestResult ?? "—"}</strong>
                        </div>
                      </div>
                      <div className="profile-links">
                        {(() => {
                          const twitchLink = normalizeSocialLink(playerProfile.twitch, "twitch");
                          const tiktokLink = normalizeSocialLink(playerProfile.tiktok, "tiktok");
                          return (
                            <>
                              {twitchLink && (
                                <a href={twitchLink} target="_blank" rel="noreferrer">
                                  <TwitchIcon />
                                  <span>Twitch</span>
                                </a>
                              )}
                              {tiktokLink && (
                                <a href={tiktokLink} target="_blank" rel="noreferrer">
                                  <TikTokIcon />
                                  <span>TikTok</span>
                                </a>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="panel-header inline">
                    <div>
                      <p className="panel-label">Performance by Season</p>
                      <h4>Per-game</h4>
                    </div>
                  </div>
                  {seasonLoading ? (
                    <p className="empty">Loading season breakdown...</p>
                  ) : seasonTableRows.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Season</th>
                            <th>Series</th>
                            <th>Goals</th>
                            <th>Assists</th>
                            <th>Saves</th>
                            <th>Demos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {seasonTableRows.map((row) => (
                            <tr key={row.season}>
                              <td>{row.season}</td>
                              <td>{formatValue(row.seriesPlayed)}</td>
                              <td>{formatStat(row.goals, "float", "avg")}</td>
                              <td>{formatStat(row.assists, "float", "avg")}</td>
                              <td>{formatStat(row.saves, "float", "avg")}</td>
                              <td>{formatStat(row.demos, "float", "avg")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="empty">No season data for this player.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function PlayerProfilePage() {
  const { uniqueId } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ season: "", split: "", event: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [playerProfileLoading, setPlayerProfileLoading] = useState(false);
  const [seasonRows, setSeasonRows] = useState<SeasonRow[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);

  const filterParams = useMemo(() => {
    return {
      season: filters.season || undefined,
      split: filters.split || undefined,
      event: filters.event || undefined
    };
  }, [filters]);

  const seasonTableRows = useMemo(() => {
    if (filters.season) {
      return seasonRows;
    }
    if (!playerProfile) {
      return [];
    }
    return [buildSeasonSummaryRow(playerProfile)];
  }, [filters.season, playerProfile, seasonRows]);

  useEffect(() => {
    let ignore = false;
    async function loadMeta() {
      try {
        const response = await fetchJson<MetaResponse>("/api/meta", {
          season: filters.season || undefined,
          split: filters.split || undefined
        });
        if (!ignore) {
          setMeta(response);
          setMetaError(null);
        }
      } catch (error) {
        if (!ignore) {
          setMetaError(error instanceof Error ? error.message : "Failed to load metadata");
        }
      }
    }

    loadMeta();
    return () => {
      ignore = true;
    };
  }, [filters.season, filters.split]);

  useEffect(() => {
    if (!uniqueId) return;
    let ignore = false;
    async function loadProfile() {
      try {
        setPlayerProfileLoading(true);
        const response = await fetchJson<{ player: PlayerProfile }>(
          `/api/players/${encodeURIComponent(uniqueId)}`,
          filterParams
        );
        if (!ignore) {
          setPlayerProfile(response.player);
        }
      } catch (error) {
        if (!ignore) {
          setPlayerProfile(null);
        }
      } finally {
        if (!ignore) {
          setPlayerProfileLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      ignore = true;
    };
  }, [uniqueId, filterParams]);

  useEffect(() => {
    if (!uniqueId) return;
    let ignore = false;
    async function loadSeason() {
      try {
        setSeasonLoading(true);
        const response = await fetchJson<SeasonResponse>(
          `/api/players/${encodeURIComponent(uniqueId)}/season`,
          {
            ...filterParams,
            mode: "avg"
          }
        );
        if (!ignore) {
          setSeasonRows(response.rows ?? []);
        }
      } catch (error) {
        if (!ignore) {
          setSeasonRows([]);
        }
      } finally {
        if (!ignore) {
          setSeasonLoading(false);
        }
      }
    }

    loadSeason();
    return () => {
      ignore = true;
    };
  }, [uniqueId, filterParams]);

  return (
    <div className="page">
      <header className="topbar profile-topbar">
        <div className="brand">
          <p className="eyebrow">Player Profile</p>
          <h1>{playerProfile?.handle ?? "Player Profile"}</h1>
          <p className="lede">
            Full player dossier with season splits, stat aggregates, and debut tracking.
          </p>
          <div className="profile-actions">
            <button type="button" className="ghost" onClick={() => navigate("/")}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      {metaError && <div className="error-banner">{metaError}</div>}

      <section className="panel players-panel">
        <div className="panel-header">
          <div>
            <p className="panel-label">Player Detail</p>
            <h2>Profile Overview</h2>
          </div>
        </div>
        <div className="player-profile">
          {playerProfileLoading && <p className="empty">Loading profile...</p>}
          {!playerProfileLoading && !playerProfile && (
            <p className="empty">Player not found. Try another selection.</p>
          )}
          {playerProfile && (
            <>
              <div className="profile-header">
                <div className="avatar large">
                  {playerProfile.photoUrl ? (
                    <img
                      src={proxyImageUrl(playerProfile.photoUrl) ?? undefined}
                      alt={playerProfile.handle ?? "Player"}
                    />
                  ) : (
                    <span>
                      {(playerProfile.handle ?? playerProfile.playerName ?? "?")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  {(() => {
                    const aliases = formatAliases(playerProfile.aliases);
                    return (
                      <>
                        <h3>{playerProfile.handle ?? playerProfile.playerName ?? "Unknown"}</h3>
                        {playerProfile.realName && (
                          <p className="profile-line">
                            <strong>Real name</strong>
                            {playerProfile.realName}
                          </p>
                        )}
                        {aliases && (
                          <p className="profile-line">
                            <strong>Aliases</strong>
                            {aliases}
                          </p>
                        )}
                      </>
                    );
                  })()}
                  <div className="profile-meta">
                    <div>
                      <span>Country</span>
                      <strong>{playerProfile.country ?? "—"}</strong>
                    </div>
                    <div>
                      <span>Date of Birth</span>
                      <strong>{formatDate(playerProfile.dateOfBirth)}</strong>
                    </div>
                    <div>
                      <span>Age</span>
                      <strong>{computeAge(playerProfile.dateOfBirth)}</strong>
                    </div>
                    <div>
                      <span>Debut</span>
                      <strong>{formatDate(playerProfile.debutDate)}</strong>
                    </div>
                    <div>
                      <span>Best Result</span>
                      <strong>{playerProfile.bestResult ?? "—"}</strong>
                    </div>
                  </div>
                  <div className="profile-links">
                    {(() => {
                      const twitchLink = normalizeSocialLink(playerProfile.twitch, "twitch");
                      const tiktokLink = normalizeSocialLink(playerProfile.tiktok, "tiktok");
                      return (
                        <>
                          {twitchLink && (
                            <a href={twitchLink} target="_blank" rel="noreferrer">
                              <TwitchIcon />
                              <span>Twitch</span>
                            </a>
                          )}
                          {tiktokLink && (
                            <a href={tiktokLink} target="_blank" rel="noreferrer">
                              <TikTokIcon />
                              <span>TikTok</span>
                            </a>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="panel-header inline">
                <div>
                  <p className="panel-label">Performance by Season</p>
                  <h4>Per-game</h4>
                </div>
                <div className="profile-header-controls">
                  <button
                    type="button"
                    className="ghost"
                    aria-pressed={showFilters}
                    onClick={() => setShowFilters((prev) => !prev)}
                  >
                    Filter
                  </button>
                </div>
              </div>
              {showFilters && (
                <div className="filters profile-filters profile-filter-row">
                  <label>
                    Season
                    <select
                      value={filters.season}
                      onChange={(event) =>
                        setFilters({
                          season: event.target.value,
                          split: "",
                          event: ""
                        })
                      }
                    >
                      <option value="">All</option>
                      {(meta?.seasons ?? []).map((season) => (
                        <option key={season} value={season}>
                          {season}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Split
                    <select
                      value={filters.split}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          split: event.target.value,
                          event: ""
                        }))
                      }
                      disabled={!filters.season}
                    >
                      <option value="">All</option>
                      {(meta?.splits ?? []).map((split) => (
                        <option key={split} value={split}>
                          {split}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Event
                    <select
                      value={filters.event}
                      onChange={(event) =>
                        setFilters((prev) => ({ ...prev, event: event.target.value }))
                      }
                      disabled={!filters.season || !filters.split}
                    >
                      <option value="">All</option>
                      {(meta?.events ?? []).map((event) => (
                        <option key={event} value={event}>
                          {event}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {seasonLoading ? (
                <p className="empty">Loading season breakdown...</p>
              ) : seasonTableRows.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Season</th>
                        <th>Series</th>
                        <th>Goals</th>
                        <th>Assists</th>
                        <th>Saves</th>
                        <th>Demos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seasonTableRows.map((row) => (
                        <tr key={row.season}>
                          <td>{row.season}</td>
                          <td>{formatValue(row.seriesPlayed)}</td>
                          <td>{formatStat(row.goals, "float", "avg")}</td>
                          <td>{formatStat(row.assists, "float", "avg")}</td>
                          <td>{formatStat(row.saves, "float", "avg")}</td>
                          <td>{formatStat(row.demos, "float", "avg")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty">No season data for this player.</p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/uniqueid/:uniqueId" element={<PlayerProfilePage />} />
      <Route path="*" element={<Dashboard />} />
    </Routes>
  );
}
