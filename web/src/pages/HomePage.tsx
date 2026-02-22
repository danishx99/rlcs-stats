import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LeaderboardResponse, SearchResponse, StatOption, StandingsResponse, TopQueryCategory } from "../types/api";
import { api } from "../api";
import { proxyImageUrl } from "../utils/normalize";
import { formatStat } from "../utils/format";
import { toOrgRosterId } from "../utils/roster";
import TeamNameWithLogo from "../components/TeamNameWithLogo";

/*
 * Preserved featured insight presets (available via api.featured):
 * - least_grounded: Least Grounded (lowest on-ground %)
 * - best_grand_finals: Best in Grand Finals
 * - best_decider: Best in Deciders
 * - fastest_player: Fastest Player (avg speed)
 * - best_ot: Best in Overtime
 * - most_demos: Most Demos per Game
 */

export type HomePageProps = {
  filters: { season: string; split: string; event: string };
  latestSeason: string | null;
  featuredOptions: StatOption[];
};

const SEARCH_DEBOUNCE_MS = 500;
const PLAYER_SEARCH_DEBOUNCE_MS = 500;
const ROTATING_FEATURED_METRICS = ["rating", "goals", "saves", "demos", "shots", "assists"] as const;

export default function HomePage({ filters, latestSeason, featuredOptions }: HomePageProps) {
  const navigate = useNavigate();
  const [featuredMetricKey] = useState<string>(() => {
    const index = Math.floor(Math.random() * ROTATING_FEATURED_METRICS.length);
    return ROTATING_FEATURED_METRICS[index];
  });
  const [featuredLeaderboard, setFeaturedLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [topQueries, setTopQueries] = useState<TopQueryCategory[]>([]);
  const [topQueriesLoading, setTopQueriesLoading] = useState(false);
  const [expandedTopQueryKey, setExpandedTopQueryKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerResults, setPlayerResults] = useState<SearchResponse["players"]>([]);
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
  const [playerSearchError, setPlayerSearchError] = useState<string | null>(null);
  const [standings, setStandings] = useState<StandingsResponse | null>(null);
  const [standingsSeason, setStandingsSeason] = useState<string>("");
  const searchRef = useRef<HTMLDivElement>(null);

  // Load rotating featured leaderboard for the latest season
  useEffect(() => {
    if (!latestSeason) return;
    async function loadFeaturedLeaderboard() {
      setFeaturedLoading(true);
      try {
        const response = await api.statsTop({
          metric: featuredMetricKey,
          type: "player",
          mode: "avg",
          season: latestSeason,
          limit: 6
        });
        setFeaturedLeaderboard(response);
      } catch (error) {
        console.error(error);
      } finally {
        setFeaturedLoading(false);
      }
    }
    loadFeaturedLeaderboard();
  }, [latestSeason, featuredMetricKey]);

  // Load standings
  useEffect(() => {
    const season = standingsSeason || latestSeason;
    if (!season) return;
    async function loadStandings() {
      try {
        const response = await api.standings({ season });
        setStandings(response);
        if (!standingsSeason && response.season) {
          setStandingsSeason(response.season);
        }
      } catch (error) {
        console.error(error);
      }
    }
    loadStandings();
  }, [latestSeason, standingsSeason]);

  useEffect(() => {
    async function loadTopQueries() {
      setTopQueriesLoading(true);
      try {
        const response = await api.insights({
          limit: 6
        });
        setTopQueries(response.categories ?? []);
      } catch (error) {
        console.error(error);
        setTopQueries([]);
      } finally {
        setTopQueriesLoading(false);
      }
    }
    loadTopQueries();
  }, []);

  // Global search (search bar under hero)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }
    let isActive = true;
    const timeout = setTimeout(async () => {
      if (!isActive) return;
      setSearchLoading(true);
      setSearchError(null);
      try {
        const response = await api.search({ q: searchQuery });
        if (!isActive) return;
        setSearchResults(response);
      } catch (error) {
        if (!isActive) return;
        console.error(error);
        setSearchResults(null);
        setSearchError("Search failed. Please try again.");
      } finally {
        if (!isActive) return;
        setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults(null);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Player-only search (bottom section)
  useEffect(() => {
    if (!playerQuery.trim()) {
      setPlayerResults([]);
      setPlayerSearchError(null);
      setPlayerSearchLoading(false);
      return;
    }
    let isActive = true;
    const timeout = setTimeout(async () => {
      if (!isActive) return;
      setPlayerSearchLoading(true);
      setPlayerSearchError(null);
      try {
        const response = await api.search({ q: playerQuery });
        if (!isActive) return;
        setPlayerResults(response.players ?? []);
      } catch (error) {
        if (!isActive) return;
        console.error(error);
        setPlayerResults([]);
        setPlayerSearchError("Search failed. Please try again.");
      } finally {
        if (!isActive) return;
        setPlayerSearchLoading(false);
      }
    }, PLAYER_SEARCH_DEBOUNCE_MS);
    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [playerQuery]);

  const players = searchResults?.players ?? [];
  const teams = searchResults?.teams ?? [];
  const stats = searchResults?.stats ?? [];
  const events = searchResults?.events ?? [];
  const hasResults = players.length > 0 || teams.length > 0 || stats.length > 0 || events.length > 0;

  const seasonLabel = latestSeason || "All Time";
  const featuredTitle = featuredLeaderboard?.metric?.label
    ?? featuredOptions.find((option) => option.key === featuredMetricKey)?.label
    ?? "Featured";

  return (
    <div className="dash">
      {/* 1. Hero */}
      <header className="dash-hero">
        <span className="dash-badge">SSA Stats Hub</span>
        <h1 className="dash-title">RLCS<span>SSA</span></h1>
        <p className="dash-subtitle">Sub-Saharan Africa Championship Statistics</p>
        <div className="dash-hero-edge" />
      </header>

      {/* 2. Search Bar */}
      <div className="dash-search-area" ref={searchRef}>
        <div className="dash-search-bar">
          <svg className="dash-search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="M13 13l4 4" />
          </svg>
          <input
            type="text"
            placeholder="Search players, teams, stats or events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="dash-search-clear"
              onClick={() => { setSearchQuery(""); setSearchResults(null); }}
            >
              &times;
            </button>
          )}
        </div>
        {searchQuery.trim() && (
          <div className="dash-search-dropdown">
            {searchLoading && <p className="dash-search-status">Searching...</p>}
            {!searchLoading && searchError && <p className="dash-search-status">{searchError}</p>}
            {!searchLoading && !searchError && !hasResults && <p className="dash-search-status">No results found</p>}
            {!searchLoading && !searchError && hasResults && (
              <>
                {players.length > 0 && (
                  <div className="dash-search-group">
                    <div className="dash-search-group-title">Players</div>
                    {players.slice(0, 5).map((p) => {
                      const img = proxyImageUrl(p.meta?.photoUrl);
                      return (
                        <div
                          key={p.id}
                          className="dash-search-item"
                          onClick={() => { setSearchQuery(""); navigate(`/players/${p.id}`); }}
                        >
                          <div className="dash-search-avatar">
                            {img ? <img src={img} alt="" /> : p.label.charAt(0)}
                          </div>
                          <div className="dash-search-item-info">
                            <strong>{p.label}</strong>
                            {p.meta?.realName && <span>{p.meta.realName}</span>}
                          </div>
                          <span className="dash-search-type">Player</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {teams.length > 0 && (
                  <div className="dash-search-group">
                    <div className="dash-search-group-title">Teams</div>
                    {teams.slice(0, 5).map((team) => {
                      const img = proxyImageUrl(team.meta?.photoUrl);
                      return (
                        <div
                          key={team.id}
                          className="dash-search-item"
                          onClick={() => { setSearchQuery(""); navigate(`/rosters/${encodeURIComponent(team.id)}`); }}
                        >
                          <div className="dash-search-avatar dash-search-avatar--logo">
                            {img ? <img src={img} alt="" /> : team.label.charAt(0)}
                          </div>
                          <div className="dash-search-item-info">
                            <strong>{team.label}</strong>
                            {team.meta?.starters && <span>{team.meta.starters.join(", ")}</span>}
                          </div>
                          <span className="dash-search-type">Team</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {stats.length > 0 && (
                  <div className="dash-search-group">
                    <div className="dash-search-group-title">Stats</div>
                    {stats.slice(0, 4).map((s) => (
                      <div
                        key={s.id}
                        className="dash-search-item"
                        onClick={() => { setSearchQuery(""); navigate(`/stats/${s.id}`); }}
                      >
                        <div className="dash-search-avatar dash-search-avatar--stat">#</div>
                        <div className="dash-search-item-info">
                          <strong>{s.label}</strong>
                        </div>
                        <span className="dash-search-type">Leaderboard</span>
                      </div>
                    ))}
                  </div>
                )}
                {events.length > 0 && (
                  <div className="dash-search-group">
                    <div className="dash-search-group-title">Events</div>
                    {events.slice(0, 5).map((ev) => (
                      <div
                        key={`${ev.meta?.season}-${ev.meta?.split}-${ev.id}`}
                        className="dash-search-item"
                        onClick={() => {
                          setSearchQuery("");
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
              </>
            )}
          </div>
        )}
      </div>

      {/* 3. Nav Row: buttons left, standings right */}
      <div className="dash-nav-row">
        <div className="dash-nav-buttons">
          <div className="dash-nav-card" onClick={() => navigate("/compare")}>
            <div className="dash-nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M4 4l17 17" />
              </svg>
            </div>
            <div>
              <strong>Head to Head</strong>
              <span>Compare player &amp; team stats</span>
            </div>
            <svg className="dash-nav-arrow" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4l6 6-6 6" /></svg>
          </div>

          <div className="dash-nav-card" onClick={() => navigate("/stats/score")}>
            <div className="dash-nav-icon dash-nav-icon--blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 20V10M12 20V4M6 20v-6" />
              </svg>
            </div>
            <div>
              <strong>Top Performing Teams &amp; Players</strong>
              <span>Leaderboards &amp; rankings</span>
            </div>
            <svg className="dash-nav-arrow" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4l6 6-6 6" /></svg>
          </div>

        </div>

        <div className="dash-standings">
          <div className="dash-standings-header">
            <span className="dash-label">Standings</span>
            {standings && standings.seasons.length > 0 ? (
              <select
                className="dash-standings-select"
                value={standingsSeason || standings.season}
                onChange={(e) => setStandingsSeason(e.target.value)}
              >
                {standings.seasons.map((season) => (
                  <option key={season} value={season}>{season}</option>
                ))}
              </select>
            ) : (
              <span className="dash-standings-season">{latestSeason ?? standings?.season ?? "Latest"}</span>
            )}
          </div>
          <ol className="dash-standings-list">
            {standings && standings.rows.length > 0
              ? standings.rows.slice(0, 8).map((row) => {
                  const maxPts = standings.rows[0].points || 1;
                  const barWidth = Math.round((row.points / maxPts) * 100);
                  const logoSrc = proxyImageUrl(row.logoUrl);
                  const orgId = toOrgRosterId(row.teamName);
                  return (
                    <li
                      key={row.rank}
                      className="dash-standings-item"
                      onClick={() => navigate(`/rosters/${encodeURIComponent(orgId)}`)}
                    >
                      <span className="dash-standings-rank">{row.rank}</span>
                      <div className="dash-standings-logo">
                        {logoSrc ? <img src={logoSrc} alt="" /> : null}
                      </div>
                      <div className="dash-standings-bar-wrap">
                        <span className="dash-standings-team">{row.teamName}</span>
                        <div
                          className="dash-standings-bar"
                          style={{ "--bar-width": `${barWidth}%` } as React.CSSProperties}
                        />
                      </div>
                      <span className="dash-standings-pts">{row.points}</span>
                    </li>
                  );
                })
              : Array.from({ length: 8 }).map((_, i) => (
                  <li key={`slot-${i}`}>
                    <span className="dash-standings-rank">{i + 1}</span>
                    <div className="dash-standings-logo" />
                    <div className="dash-standings-bar-wrap">
                      <div className="dash-standings-bar" />
                    </div>
                    <span className="dash-standings-pts">&mdash;</span>
                  </li>
                ))}
          </ol>
        </div>
      </div>

      <section className="dash-insights-grid">
        <div className="dash-insights-panel dash-queries-panel">
          <div className="dash-featured-header">
            <div>
              <span className="dash-label">Top Queries &middot; All Seasons</span>
              <h2>Fast Insights</h2>
            </div>
          </div>
          {topQueriesLoading ? (
            <p className="dash-empty">Loading queries...</p>
          ) : topQueries.length === 0 ? (
            <p className="dash-empty">No query data available.</p>
          ) : (
            <div className="dash-query-list">
              {topQueries.map((query) => {
                const topRow = query.rows[0];
                const isExpanded = expandedTopQueryKey === query.key;
                return (
                  <article
                    key={query.key}
                    className={`dash-query-tile${isExpanded ? " is-expanded" : ""}`}
                  >
                    <div className="dash-query-tile-head">
                      <h3>{query.title}</h3>
                      <button
                        type="button"
                        className="dash-query-toggle"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedTopQueryKey(isExpanded ? null : query.key)}
                      >
                        {isExpanded ? "Hide Top 6" : "Show Top 6"}
                      </button>
                    </div>
                    <div className="dash-query-tile-body">
                      {topRow ? (
                        <>
                          <span className="dash-query-tile-name">{topRow.label}</span>
                          <span className="dash-query-tile-value">{topRow.valueDisplay}</span>
                        </>
                      ) : (
                        <span className="dash-query-tile-name">No data</span>
                      )}
                    </div>
                    <div className="dash-query-hover-rows">
                      {query.rows.slice(0, 6).map((row, index) => {
                        const [contextPrimary, contextTeams] = (row.context ?? "").split(" • ");
                        return (
                          <div key={`${query.key}-${row.id}-${index}`} className="dash-query-row">
                            <span className="dash-query-rank">{index + 1}</span>
                            <div className="dash-query-entity">
                              {row.entityType === "player" ? (
                                <span>{row.label}</span>
                              ) : (
                                <span className="dash-query-match">{row.label}</span>
                              )}
                              {contextPrimary ? <span className="dash-query-context">{contextPrimary}</span> : null}
                              {contextTeams ? <span className="dash-query-context-team">{contextTeams}</span> : null}
                            </div>
                            <span className="dash-query-value" title={query.valueLabel}>{row.valueDisplay}</span>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="dash-insights-panel dash-profiles-panel">
          <div className="dash-featured-header">
            <div>
              <span className="dash-label">Featured Profiles &middot; {seasonLabel}</span>
              <h2>{featuredTitle}</h2>
            </div>
          </div>
          {featuredLoading && <p className="dash-empty">Loading...</p>}
          {!featuredLoading && featuredLeaderboard?.rows?.length ? (
            <div className="featured-cards">
              {featuredLeaderboard.rows.slice(0, 6).map((row, index) => {
                const imgSrc = proxyImageUrl(row.photoUrl);
                return (
                  <div
                    key={row.id}
                    className="featured-card"
                    style={{ animationDelay: `${index * 60}ms` }}
                    onClick={() => navigate(`/players/${row.id}`)}
                  >
                    <div className="featured-card-photo">
                      {imgSrc ? (
                        <img src={imgSrc} alt={row.label} loading="lazy" />
                      ) : (
                        <span className="card-avatar">{row.label.charAt(0)}</span>
                      )}
                    </div>
                    <div className="featured-card-info">
                      <strong>{row.label}</strong>
                      <span className="card-team">
                        {row.teams[0] ? <TeamNameWithLogo team={row.teams[0]} /> : "—"}
                      </span>
                      <span className="card-value">
                        {formatStat(row.value, featuredLeaderboard.metric.format, featuredLeaderboard.mode)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            !featuredLoading && <p className="dash-empty">No data available.</p>
          )}

          <div className="dash-player-search">
            <h3>Find a Player Profile</h3>
            <div className="dash-search-bar dash-player-bar">
              <svg className="dash-search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="M13 13l4 4" />
              </svg>
              <input
                type="text"
                placeholder="Search players..."
                value={playerQuery}
                onChange={(e) => setPlayerQuery(e.target.value)}
              />
            </div>
            {playerQuery.trim() && (
              <div className="dash-player-results">
                {playerSearchLoading && <p className="dash-empty">Searching...</p>}
                {!playerSearchLoading && playerSearchError && <p className="dash-empty">{playerSearchError}</p>}
                {!playerSearchLoading && playerResults.length > 0 &&
                  playerResults.slice(0, 6).map((player) => {
                    const imgSrc = proxyImageUrl(player.meta?.photoUrl);
                    return (
                      <div
                        key={player.id}
                        className="dash-player-card"
                        onClick={() => { setPlayerQuery(""); navigate(`/players/${player.id}`); }}
                      >
                        <div className="dash-search-avatar">
                          {imgSrc ? <img src={imgSrc} alt="" /> : player.label.charAt(0).toUpperCase()}
                        </div>
                        <div className="dash-player-card-info">
                          <strong>{player.label}</strong>
                          <span>{player.meta?.realName ?? ""}</span>
                        </div>
                      </div>
                    );
                  })}
                {!playerSearchLoading && !playerSearchError && playerResults.length === 0 && (
                  <p className="dash-empty">No players found.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="dash-acknowledgements">
        <div className="dash-featured-header">
          <div>
            <span className="dash-label">Acknowledgements</span>
            <h2>Community & Data Credits</h2>
          </div>
        </div>
        <p>
          This resource is only possible because so many in the Rocket League community work so hard at it.
          In particular, I want to acknowledge the invaluable work of:
        </p>
        <ul className="dash-ack-list">
          <li>
            <a href="https://ballchasing.com" target="_blank" rel="noreferrer noopener">
              Ballchasing.com
            </a>
            {" "}for providing a means to preserve the replays from all RLCS games.
          </li>
          <li>
            <a href="https://lndrlndr.github.io/" target="_blank" rel="noreferrer noopener">
              CARL
            </a>
            {" "}- an invaluable analytics tool for coaches which we used to extract every major
            and minor stat from every game, the backbone of this database.
          </li>
          <li>
            <a href="https://liquipedia.net/rocketleague/Main_Page" target="_blank" rel="noreferrer noopener">
              Liquipedia
            </a>
            {" "}- the unwavering archivists of everything competitive Rocket League.
          </li>
          <li>
            <a href="https://x.com/Borkey_" target="_blank" rel="noreferrer noopener">
              Borkey
            </a>
            {" "}for hours of work helping ensure the accuracy of the spreadsheets on which this data is based.
          </li>
          <li>
            <a href="https://danishsaleem.com" target="_blank" rel="noreferrer noopener">
              D-Money
            </a>
            {" "}for coding and building this website.
          </li>
        </ul>
      </section>
    </div>
  );
}
