import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { EventBracket, EventDetail, EventTeam, LeaderboardResponse, MetaResponse, SearchResponse, StatCategory, StatOption } from "../types/api";
import { proxyImageUrl } from "../utils/normalize";
import { formatDate } from "../utils/date";
import { buildEventPath } from "../utils/event-routing";
import { sortEventsLanLast } from "../utils/events";
import Leaderboard from "../components/Leaderboard";
import PlayerNameWithPhoto from "../components/PlayerNameWithPhoto";
import StatPicker from "../components/StatPicker";
import TeamNameWithLogo from "../components/TeamNameWithLogo";
import PanelState from "../components/ui/PanelState";
import SkeletonBlock from "../components/ui/SkeletonBlock";
import SkeletonRows from "../components/ui/SkeletonRows";
import PageBackActions from "../components/PageBackActions";

const CORE_LEADERBOARDS = [
  { key: "rating", title: "Top 10 Players (Rating)" },
  { key: "goals", title: "Top Scorers (Goals)" },
  { key: "demos", title: "Top Executioners (Demos)" },
  { key: "saves", title: "Top Saviours (Saves)" },
  { key: "assists", title: "Top Playmakers" }
] as const;
const CORE_LEADERBOARD_KEYS = new Set<string>(CORE_LEADERBOARDS.map((item) => item.key));
const DEFAULT_STATS: string[] = [];
const SUGGESTED_STATS = ["shots", "score", "avg_speed", "on_ground", "in_air"];
const SEARCH_DEBOUNCE_MS = 500;
const TOP_TEAMS_LIMIT = 8;
const FULL_TEAMS_LIMIT = 256;

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
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [leaderboardMode, setLeaderboardMode] = useState<"avg" | "total">("avg");
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [teams, setTeams] = useState<EventTeam[]>([]);
  const [showAllPlacements, setShowAllPlacements] = useState(false);
  const [bracket, setBracket] = useState<EventBracket | null>(null);
  const [leaderboards, setLeaderboards] = useState<LeaderboardResponse[]>([]);
  const [leaderboardsLoading, setLeaderboardsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventRetryKey, setEventRetryKey] = useState(0);

  // Event search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse["events"]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Navigation filter state
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [filterSeason, setFilterSeason] = useState("");
  const [filterSplit, setFilterSplit] = useState("");

  // Pick a stat state
  const [statCategories, setStatCategories] = useState<StatCategory[]>([]);
  const [selectedStats, setSelectedStats] = useState<string[]>(DEFAULT_STATS);
  const [leaderboardMap, setLeaderboardMap] = useState<Map<string, LeaderboardResponse>>(new Map());
  const [loadingStats, setLoadingStats] = useState<Set<string>>(new Set());
  const [statLoadErrors, setStatLoadErrors] = useState<Map<string, string>>(new Map());

  // Load event data
  useEffect(() => {
    if (!eventId) return;
    setLeaderboardMode("avg");
    const targetEventId = decodeURIComponent(eventId);

    async function loadEvent() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.eventDetail(targetEventId, {
          teamsLimit: FULL_TEAMS_LIMIT,
        });
        setTeams(response.teams);
        setEvent(response.event);
        setBracket(response.bracket);
        setLeaderboards(response.leaderboards);
      } catch (err) {
        const message = err instanceof Error ? err.message.toLowerCase() : "";
        console.error(err);
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
  }, [eventId, eventRetryKey]);

  // Re-fetch core leaderboards when mode changes (without full page reload)
  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    setLeaderboardsLoading(true);

    Promise.all(
      CORE_LEADERBOARDS.map(({ key }) =>
        api.statsTop({
          metric: key,
          event: event.name,
          season: event.season ?? undefined,
          split: event.split ?? undefined,
          gameMode: event.mode ?? undefined,
          scope: event.scope ?? undefined,
          tier: event.tier ?? undefined,
          mode: leaderboardMode,
          limit: 10,
        })
      )
    ).then((results) => {
      if (cancelled) return;
      setLeaderboards(results);
    }).catch(console.error)
    .finally(() => {
      if (!cancelled) setLeaderboardsLoading(false);
    });

    return () => { cancelled = true; };
  }, [event, leaderboardMode]);

  // Pre-fill filters from current event
  useEffect(() => {
    if (!event) return;
    setFilterSeason(event.season ?? "");
    setFilterSplit(event.split ?? "");
  }, [event]);

  // Load navigation filter options (cascading)
  useEffect(() => {
    if (!event) return;
    const params: Record<string, string> = {};
    if (filterSeason) params.season = filterSeason;
    if (filterSplit) params.split = filterSplit;
    if (event.mode) params.gameMode = event.mode;
    if (event.scope) params.scope = event.scope;
    if (event.tier) params.tier = event.tier;
    setMetaLoading(true);
    setMetaError(null);
    api.meta(params)
      .then(setMeta)
      .catch((metaLoadError) => {
        console.error(metaLoadError);
        setMeta(null);
        setMetaError("Failed to load event navigation filters.");
      })
      .finally(() => setMetaLoading(false));
  }, [event, filterSeason, filterSplit]);

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
  const navigationEventOptions = useMemo(
    () => sortEventsLanLast(meta?.events ?? [], meta?.internationalEvents ?? []),
    [meta?.events, meta?.internationalEvents]
  );

  const toggleStat = (key: string) => {
    setSelectedStats((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Event search (debounced)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const response = await api.search({ q: searchQuery });
        const events = (response.events ?? []).filter(
          (ev) => ev.meta?.scope !== "international"
        );
        setSearchResults(events);
      } catch (err) {
        console.error(err);
        setSearchResults([]);
        setSearchError("Failed to search events.");
      } finally {
        setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
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
    setStatLoadErrors(new Map());
  }, [eventId, leaderboardMode]);

  // Fetch leaderboards for extra selected stats (defaults are already in hardcoded cards)
  useEffect(() => {
    const extraStats = selectedStats.filter((k) => !DEFAULT_STATS.includes(k) && !CORE_LEADERBOARD_KEYS.has(k));
    if (!event || extraStats.length === 0) {
      setLeaderboardMap((prev) => (prev.size === 0 ? prev : new Map()));
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
      setStatLoadErrors((prev) => {
        const next = new Map(prev);
        for (const key of prev.keys()) {
          if (!extraStats.includes(key)) next.delete(key);
        }
        return next;
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
          event: event.name,
          season: event.season ?? undefined,
          split: event.split ?? undefined,
          gameMode: event.mode ?? undefined,
          scope: event.scope ?? undefined,
          tier: event.tier ?? undefined,
          mode: leaderboardMode,
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
      setStatLoadErrors((prev) => {
        const next = new Map(prev);
        outcomes.forEach((outcome, index) => {
          if (outcome.status === "rejected") {
            const reason = outcome.reason instanceof Error ? outcome.reason.message : "Request failed";
            const metric = toFetch[index];
            if (metric) next.set(metric, reason);
          }
        });
        return next;
      });
      setLoadingStats((prev) => {
        const next = new Set(prev);
        toFetch.forEach((k) => next.delete(k));
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [event, leaderboardMap, leaderboardMode, selectedStats]);

  if (loading) {
    return (
      <div className="page page-no-nav" aria-busy="true">
        <PageBackActions />
        <div className="event-top-bar">
          <SkeletonBlock height={44} width="100%" />
          <div className="event-nav-filters">
            <SkeletonBlock height={38} />
            <SkeletonBlock height={38} />
            <SkeletonBlock height={38} />
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <SkeletonBlock height={30} width="52%" />
          <div style={{ marginTop: 6 }}><SkeletonBlock height={14} width="44%" /></div>
        </div>
        <div className="event-grid">
          <div className="event-panel event-panel--bracket panel">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`place-skel-${i}`} className="skel-placement-row">
                <SkeletonBlock width={22} height={22} rounded="pill" />
                <SkeletonBlock width={28} height={28} rounded="pill" />
                <SkeletonBlock height={14} width={`${140 - i * 8}px`} />
              </div>
            ))}
          </div>
          <div className="event-panel panel">
            <SkeletonBlock height={280} width="100%" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="page page-no-nav">
        <PageBackActions />
        <div className="empty-state">{error || "Event not found."}</div>
        {error ? (
          <div style={{ marginTop: 10 }}>
            <button type="button" className="ghost" onClick={() => setEventRetryKey((value) => value + 1)}>
              Retry
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const dateRange = [event.minDate, event.maxDate]
    .filter(Boolean)
    .map((d) => formatDate(d!))
    .join(" – ");
  const isLanEvent = event.scope === "international" && (event.tier === "major" || event.tier === "worlds");

  const hasSearchResults = searchResults.length > 0;
  const coreLeaderboardMap = new Map(leaderboards.map((lb) => [lb.metric.key, lb]));
  const coreLeaderboards = CORE_LEADERBOARDS.reduce<Array<{ title: string; data: LeaderboardResponse }>>((acc, item) => {
    const data = coreLeaderboardMap.get(item.key);
    if (data) {
      acc.push({ title: item.title, data });
    }
    return acc;
  }, []);
  const selectedExtraStats = selectedStats.filter((k) => !CORE_LEADERBOARD_KEYS.has(k));
  const isInProgress = event.status === "in_progress";
  const visibleTeams = showAllPlacements || isInProgress ? teams : teams.slice(0, TOP_TEAMS_LIMIT);
  const isOnesEvent = event.mode === "1s";
  return (
    <div className="page page-no-nav">
      <PageBackActions />

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
              {!searchLoading && searchError && <PanelState state="error" message={searchError} />}
              {!searchLoading && !searchError && !hasSearchResults && <p className="dash-search-status">No events found</p>}
              {!searchLoading && hasSearchResults && (
                <div className="dash-search-group">
                  <div className="dash-search-group-title">Events</div>
                  {searchResults.slice(0, 8).map((ev) => (
                    <Link
                      key={`${ev.meta?.season}-${ev.meta?.split}-${ev.id}`}
                      className="dash-search-item"
                      to={buildEventPath(ev.id)}
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults([]);
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
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {metaLoading && !meta ? (
          <div className="event-nav-filters" aria-hidden="true">
            <SkeletonBlock height={38} />
            <SkeletonBlock height={38} />
            <SkeletonBlock height={38} />
          </div>
        ) : null}
        {metaError ? <PanelState state="error" message={metaError} /> : null}
        {meta && (
          <div className="event-nav-filters">
            <select
              value={filterSeason}
              onChange={(e) => {
                setFilterSeason(e.target.value);
                setFilterSplit("");
              }}
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
                  void api.search({
                    q: e.target.value,
                    season: filterSeason || undefined,
                    split: filterSplit || undefined,
                    gameMode: event.mode || undefined,
                    scope: event.scope || undefined,
                    tier: event.tier || undefined,
                    limit: 20
                  }).then((response) => {
                    const match = (response.events ?? []).find((item) => item.label === e.target.value);
                    if (match) {
                      navigate(buildEventPath(match.id));
                    }
                  }).catch((lookupError) => {
                    console.error(lookupError);
                  });
                }
              }}
            >
              <option value="">Jump to Event...</option>
              {navigationEventOptions.map((ev) => (
                <option key={ev} value={ev}>{ev}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Event header */}
      <div>
        <h1 className="page-heading" style={{ marginBottom: 6 }}>{event.name}</h1>
        <div className="page-heading-sub">
          {[event.season, event.split].filter(Boolean).join(" / ")}
          {dateRange && <> &middot; {dateRange}</>}
        </div>
      </div>

      {isLanEvent ? (
        <div className="panel">
          <div className="section-header">
            <h2>LAN View Coming Soon</h2>
          </div>
          <p className="dash-search-status">
            This event currently contains only SSA-involved match slices, so the standard regional event view is not accurate.
          </p>
          <p className="dash-search-status">
            A dedicated LAN event view will be added to reflect limited-slice data properly.
          </p>
        </div>
      ) : (
        <>
          {/* Top row: Teams + Bracket */}
          <div className="event-grid">
            <div className="event-panel event-panel--bracket panel">
              <div className="event-resource-header">
                <h3>
                  {event.status === "in_progress"
                    ? "Current Standings"
                    : showAllPlacements ? "All Placements" : "Top Teams"}
                </h3>
                {event.status === "in_progress" ? (
                  <span className="badge badge--in-progress">In Progress</span>
                ) : (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setShowAllPlacements((prev) => !prev)}
                  >
                    {showAllPlacements ? "Show Top 8" : "Show All"}
                  </button>
                )}
              </div>
              {visibleTeams.length > 0 ? (
                <ol className={`event-teams-list${isOnesEvent ? " event-teams-list--ones" : ""}`}>
                  {visibleTeams.map((t, i) => {
                    const prev = i > 0 ? visibleTeams[i - 1] : null;
                    const isEliminated = t.isEliminated;
                    const prevEliminated = prev ? prev.isEliminated : false;
                    const showGroupHeader = isInProgress
                      ? (isEliminated
                          ? (!prevEliminated || prev!.placementStart !== t.placementStart || prev!.placementEnd !== t.placementEnd)
                          : i === 0 || prevEliminated)
                      : (!prev || prev.placementStart !== t.placementStart || prev.placementEnd !== t.placementEnd);
                    const groupLabel = isInProgress && !isEliminated
                      ? "TBD"
                      : placementLabel(t.placementStart, t.placementEnd);
                    return (
                      <Fragment key={t.team}>
                        {showGroupHeader && (
                          <li className="event-team-group-label">
                            {groupLabel}
                          </li>
                        )}
                        <li>
                          <span className="event-team-rank">{isInProgress && !isEliminated ? "–" : i + 1}</span>
                          {isOnesEvent ? (
                            <strong>
                              <PlayerNameWithPhoto
                                name={t.team}
                                playerId={t.uniqueId ?? null}
                                photoUrl={t.photoUrl ?? null}
                                className="identity-inline--xl"
                              />
                            </strong>
                          ) : (
                            <strong>
                              <TeamNameWithLogo team={t.team} logoUrl={t.logoUrl} />
                            </strong>
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

          <div className="tabs" style={{ marginBottom: 16 }}>
            <button
              type="button"
              className={`tab${leaderboardMode === "avg" ? " active" : ""}`}
              onClick={() => setLeaderboardMode("avg")}
            >
              Per Game
            </button>
            <button
              type="button"
              className={`tab${leaderboardMode === "total" ? " active" : ""}`}
              onClick={() => setLeaderboardMode("total")}
            >
              Total
            </button>
          </div>

          {leaderboardsLoading ? (
            <div className="event-grid event-grid--stats">
              {CORE_LEADERBOARDS.map((item) => (
                <div key={item.key} className="event-panel panel">
                  <h3>{item.title}</h3>
                  <SkeletonRows rows={10} rowHeight={26} />
                </div>
              ))}
            </div>
          ) : coreLeaderboards.length > 0 ? (
            <div className="event-grid event-grid--stats">
              {coreLeaderboards.map((item) => (
                <div key={item.data.metric.key} className="event-panel panel">
                  <h3>{item.title}</h3>
                  <Leaderboard data={item.data} showTeamLogos={false} showTeams={false} playerImageSize="large" />
                </div>
              ))}
            </div>
          ) : null}

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
          {selectedExtraStats.length > 0 && (
            <div className="event-pick-stat-grid">
              {selectedExtraStats.map((key) => {
                const data = leaderboardMap.get(key);
                const isLoading = loadingStats.has(key);
                const label = allCategoryStats.find((s) => s.key === key)?.label ?? key;
                return (
                  <div key={key} className="event-pick-stat-card panel">
                    <h4>{label}</h4>
                    {isLoading && !data ? <SkeletonRows rows={6} rowHeight={26} /> : null}
                    {!isLoading && statLoadErrors.get(key) ? (
                      <PanelState state="error" message={`Failed to load ${label}.`} />
                    ) : null}
                    {!isLoading && data && data.rows.length > 0 && (
                      <Leaderboard data={data} showTeamLogos={false} showTeams={false} playerImageSize="large" />
                    )}
                    {!isLoading && data && data.rows.length === 0 && (
                      <p className="dash-search-status">No data for this stat.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
