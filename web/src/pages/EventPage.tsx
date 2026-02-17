import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { EventBracket, EventDetail, EventTeam, LeaderboardResponse, MetaResponse, SearchResponse, StatCategory, StatOption } from "../types/api";
import { proxyImageUrl } from "../utils/normalize";
import { formatDate } from "../utils/date";
import Leaderboard from "../components/Leaderboard";
import StatPicker from "../components/StatPicker";

const DEFAULT_STATS: string[] = [];
const SUGGESTED_STATS = ["shots", "score", "avg_speed", "on_ground", "in_air"];

function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function placementLabel(start: number, end: number) {
  if (!start || !end) return "";
  if (start === end) return ordinal(start);
  return `${ordinal(start)}-${ordinal(end)}`;
}

export default function EventPage() {
  const { eventName } = useParams();
  const [searchParams] = useSearchParams();
  const urlSeason = searchParams.get("season") || undefined;
  const urlSplit = searchParams.get("split") || undefined;
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [teams, setTeams] = useState<EventTeam[]>([]);
  const [bracket, setBracket] = useState<EventBracket | null>(null);
  const [leaderboards, setLeaderboards] = useState<LeaderboardResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Event search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse["events"]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Navigation filter state
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [filterSeason, setFilterSeason] = useState("");
  const [filterSplit, setFilterSplit] = useState("");

  // Pick a stat state
  const [statCategories, setStatCategories] = useState<StatCategory[]>([]);
  const [selectedStats, setSelectedStats] = useState<string[]>(DEFAULT_STATS);
  const [leaderboardMap, setLeaderboardMap] = useState<Map<string, LeaderboardResponse>>(new Map());
  const [loadingStats, setLoadingStats] = useState<Set<string>>(new Set());

  // Load event data
  useEffect(() => {
    if (!eventName) return;
    async function loadEvent() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.eventDetail(decodeURIComponent(eventName!), { season: urlSeason, split: urlSplit });
        setEvent(response.event);
        setTeams(response.teams);
        setBracket(response.bracket);
        setLeaderboards(response.leaderboards);
      } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message.toLowerCase() : "";
        if (message.includes("not found") || message.includes("api error 404")) {
          setError("Event not found.");
        } else {
          setError("Failed to load event details.");
        }
        setBracket(null);
      } finally {
        setLoading(false);
      }
    }
    loadEvent();
  }, [eventName, urlSeason, urlSplit]);

  // Pre-fill filters from current event
  useEffect(() => {
    if (!event) return;
    setFilterSeason(event.season ?? "");
    setFilterSplit(event.split ?? "");
  }, [event]);

  // Load navigation filter options (cascading)
  useEffect(() => {
    const params: Record<string, string> = {};
    if (filterSeason) params.season = filterSeason;
    if (filterSplit) params.split = filterSplit;
    api.meta(params).then(setMeta).catch(console.error);
  }, [filterSeason, filterSplit]);

  // Load stat categories for StatPicker
  useEffect(() => {
    api.metaColumns()
      .then((data) => setStatCategories(data.categories))
      .catch(console.error);
  }, []);

  // Resolve selected stat labels from categories
  const allCategoryStats = useMemo(
    () => statCategories.flatMap((cat) => cat.stats),
    [statCategories]
  );

  const visibleStatKeys = useMemo(() => {
    const keys = new Set([...DEFAULT_STATS, ...SUGGESTED_STATS, ...selectedStats]);
    return Array.from(keys);
  }, [selectedStats]);

  const visibleStatOptions = useMemo(() => {
    const map = new Map<string, StatOption>(allCategoryStats.map((s) => [s.key, s]));
    return visibleStatKeys.map((key) => map.get(key)).filter((s): s is StatOption => Boolean(s));
  }, [visibleStatKeys, allCategoryStats]);

  const toggleStat = (key: string) => {
    setSelectedStats((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Event search (debounced)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await api.search({ q: searchQuery });
        setSearchResults(response.events ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Click outside to close search
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults([]);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset leaderboard map when event context changes
  useEffect(() => {
    setLeaderboardMap(new Map());
  }, [eventName, urlSeason, urlSplit]);

  // Fetch leaderboards for extra selected stats (defaults are already in hardcoded cards)
  useEffect(() => {
    const extraStats = selectedStats.filter((k) => !DEFAULT_STATS.includes(k));
    if (!eventName || extraStats.length === 0) {
      setLeaderboardMap(new Map());
      return;
    }

    // Remove deselected stats from map
    setLeaderboardMap((prev) => {
      const next = new Map(prev);
      for (const key of prev.keys()) {
        if (!extraStats.includes(key)) next.delete(key);
      }
      return next.size !== prev.size ? next : prev;
    });

    // Find stats that need fetching
    const toFetch = extraStats.filter((key) => !leaderboardMap.has(key));
    if (toFetch.length === 0) return;

    let cancelled = false;
    setLoadingStats((prev) => {
      const next = new Set(prev);
      toFetch.forEach((k) => next.add(k));
      return next;
    });

    Promise.allSettled(
      toFetch.map((metric) =>
        api.statsTop({
          metric,
          event: decodeURIComponent(eventName!),
          season: urlSeason,
          split: urlSplit,
          mode: "avg",
          limit: 10,
        }).then((result) => ({ metric, result }))
      )
    ).then((outcomes) => {
      if (cancelled) return;
      setLeaderboardMap((prev) => {
        const next = new Map(prev);
        for (const outcome of outcomes) {
          if (outcome.status === "fulfilled") {
            next.set(outcome.value.metric, outcome.value.result);
          }
        }
        return next;
      });
      setLoadingStats((prev) => {
        const next = new Set(prev);
        toFetch.forEach((k) => next.delete(k));
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [selectedStats, eventName, urlSeason, urlSplit, leaderboardMap]);

  if (loading) {
    return <div className="page page-no-nav">Loading event...</div>;
  }

  if (error || !event) {
    return (
      <div className="page page-no-nav">
        <button className="ghost back-button" onClick={() => navigate("/")}>
          ← Back to Dashboard
        </button>
        <div className="empty-state">{error || "Event not found."}</div>
      </div>
    );
  }

  const dateRange = [event.minDate, event.maxDate]
    .filter(Boolean)
    .map((d) => formatDate(d!))
    .join(" – ");

  const hasSearchResults = searchResults.length > 0;
  return (
    <div className="page page-no-nav">
      <button className="ghost back-button" onClick={() => navigate("/")}>
        ← Back to Dashboard
      </button>

      {/* Search bar + navigation filters */}
      <div className="event-top-bar">
        <div className="event-page-search" ref={searchRef}>
          <div className="dash-search-bar">
          <svg className="dash-search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="M13 13l4 4" />
          </svg>
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="dash-search-clear"
              onClick={() => { setSearchQuery(""); setSearchResults([]); }}
            >
              &times;
            </button>
          )}
        </div>
          {searchQuery.trim() && (
            <div className="dash-search-dropdown">
              {searchLoading && <p className="dash-search-status">Searching...</p>}
              {!searchLoading && !hasSearchResults && <p className="dash-search-status">No events found</p>}
              {!searchLoading && hasSearchResults && (
                <div className="dash-search-group">
                  <div className="dash-search-group-title">Events</div>
                  {searchResults.slice(0, 8).map((ev) => (
                    <div
                      key={`${ev.meta?.season}-${ev.meta?.split}-${ev.id}`}
                      className="dash-search-item"
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults([]);
                        const params = new URLSearchParams();
                        if (ev.meta?.season) params.set("season", ev.meta.season);
                        if (ev.meta?.split) params.set("split", ev.meta.split);
                        const query = params.toString();
                        navigate(`/events/${encodeURIComponent(ev.id)}${query ? `?${query}` : ""}`);
                      }}
                    >
                      <div className="dash-search-avatar dash-search-avatar--event">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <div className="dash-search-item-info">
                        <strong>{ev.label}</strong>
                        <span>{[ev.meta?.season, ev.meta?.split].filter(Boolean).join(" / ")}</span>
                      </div>
                      <span className="dash-search-type">Event</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {meta && (
          <div className="event-nav-filters">
            <select
              value={filterSeason}
              onChange={(e) => { setFilterSeason(e.target.value); setFilterSplit(""); }}
            >
              <option value="" disabled>Season</option>
              {meta.seasons.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filterSplit}
              onChange={(e) => setFilterSplit(e.target.value)}
            >
              <option value="">All Splits</option>
              {meta.splits.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={event.name}
              onChange={(e) => {
                if (e.target.value) {
                  const params = new URLSearchParams();
                  if (filterSeason) params.set("season", filterSeason);
                  if (filterSplit) params.set("split", filterSplit);
                  const query = params.toString();
                  navigate(`/events/${encodeURIComponent(e.target.value)}${query ? `?${query}` : ""}`);
                }
              }}
            >
              <option value="">Jump to Event...</option>
              {meta.events.map((ev) => (
                <option key={ev} value={ev}>{ev}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Event header */}
      <div className="event-page-header">
        <h1>{event.name}</h1>
        <div className="event-page-subtitle">
          {[event.season, event.split].filter(Boolean).join(" / ")}
          {dateRange && <> &middot; {dateRange}</>}
        </div>
      </div>

      {/* Top row: Teams + Bracket */}
      <div className="event-grid">
        <div className="event-panel event-panel--bracket panel">
          <h3>Top Teams</h3>
          {teams.length > 0 ? (
            <ol className="event-teams-list">
              {teams.map((t, i) => {
                const prev = i > 0 ? teams[i - 1] : null;
                const showGroupHeader = !prev || prev.placementStart !== t.placementStart || prev.placementEnd !== t.placementEnd;
                return (
                  <Fragment key={t.team}>
                    {showGroupHeader && (
                      <li className="event-team-group-label">
                        {placementLabel(t.placementStart, t.placementEnd)}
                      </li>
                    )}
                    <li onClick={() => navigate(`/rosters/${t.team}`)}>
                      <span className="event-team-rank">{i + 1}</span>
                      <div className="event-team-logo">
                        {proxyImageUrl(t.logoUrl) ? (
                          <img src={proxyImageUrl(t.logoUrl)!} alt={t.team} loading="lazy" />
                        ) : (
                          <span>{t.team.charAt(0)}</span>
                        )}
                      </div>
                      <strong>{t.team}</strong>
                      {t.deepRound && (
                        <span className="event-team-round">
                          {t.deepRound}{t.wonDeepest ? " W" : " L"}
                        </span>
                      )}
                    </li>
                  </Fragment>
                );
              })}
            </ol>
          ) : (
            <p className="dash-search-status">No placement data for this event.</p>
          )}
        </div>
        <div className="event-panel panel">
          <div className="event-resource-header">
            <h3>Bracket</h3>
            {bracket?.liquipediaUrl && (
              <a href={bracket.liquipediaUrl} target="_blank" rel="noreferrer noopener">
                View on Liquipedia
              </a>
            )}
          </div>
          {bracket && proxyImageUrl(bracket.imageUrl) ? (
            <a
              className="event-bracket-image-link"
              href={bracket.imageUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              <img
                className="event-bracket-image"
                src={proxyImageUrl(bracket.imageUrl)!}
                alt={`${event.name} bracket`}
                loading="lazy"
              />
            </a>
          ) : (
            <p className="dash-search-status">No bracket resources for this event.</p>
          )}
        </div>
      </div>

      {/* Pick a stat — checkboxes only */}
      <div className="event-pick-stat panel">
        <div className="event-pick-stat-header">
          <h3>Pick a Stat</h3>
          {statCategories.length > 0 && (
            <StatPicker
              categories={statCategories}
              selected={selectedStats}
              onToggle={toggleStat}
            />
          )}
        </div>
        {visibleStatOptions.length > 0 && (
          <div className="event-pick-stat-toggles">
            {visibleStatOptions.map((opt) => (
              <label key={opt.key} className="stat-toggle">
                <input
                  type="checkbox"
                  checked={selectedStats.includes(opt.key)}
                  onChange={() => toggleStat(opt.key)}
                />
                <span className="stat-toggle-label">{opt.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Extra leaderboards for stats beyond the defaults */}
      {selectedStats.filter((k) => !DEFAULT_STATS.includes(k)).length > 0 && (
        <div className="event-pick-stat-grid">
          {selectedStats.filter((k) => !DEFAULT_STATS.includes(k)).map((key) => {
            const data = leaderboardMap.get(key);
            const isLoading = loadingStats.has(key);
            const label = allCategoryStats.find((s) => s.key === key)?.label ?? key;
            return (
              <div key={key} className="event-pick-stat-card panel">
                <h4>{label}</h4>
                {isLoading && <p className="dash-search-status">Loading...</p>}
                {!isLoading && data && data.rows.length > 0 && <Leaderboard data={data} />}
                {!isLoading && data && data.rows.length === 0 && (
                  <p className="dash-search-status">No data for this stat.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
