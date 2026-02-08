import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FeaturedResponse, SearchResponse, StatOption } from "../types/api";
import { api } from "../api";
import { proxyImageUrl } from "../utils/normalize";
import { formatStat } from "../utils/format";

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

export default function HomePage({ filters, latestSeason, featuredOptions }: HomePageProps) {
  const navigate = useNavigate();
  const [topScorers, setTopScorers] = useState<FeaturedResponse | null>(null);
  const [topLoading, setTopLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerResults, setPlayerResults] = useState<SearchResponse["players"]>([]);
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Load top rated players for the latest season
  useEffect(() => {
    if (!latestSeason) return;
    async function loadTopScorers() {
      setTopLoading(true);
      try {
        const response = await api.featured({
          metric: "top_rated",
          season: latestSeason,
          limit: 6
        });
        setTopScorers(response);
      } catch (error) {
        console.error(error);
      } finally {
        setTopLoading(false);
      }
    }
    loadTopScorers();
  }, [latestSeason]);

  // Global search (search bar under hero)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await api.search({ q: searchQuery });
        setSearchResults(response);
      } catch (error) {
        console.error(error);
      } finally {
        setSearchLoading(false);
      }
    }, 200);
    return () => clearTimeout(timeout);
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
      return;
    }
    const timeout = setTimeout(async () => {
      setPlayerSearchLoading(true);
      try {
        const response = await api.search({ q: playerQuery });
        setPlayerResults(response.players ?? []);
      } catch (error) {
        console.error(error);
      } finally {
        setPlayerSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [playerQuery]);

  const players = searchResults?.players ?? [];
  const rosters = searchResults?.rosters ?? [];
  const stats = searchResults?.stats ?? [];
  const hasResults = players.length > 0 || rosters.length > 0 || stats.length > 0;

  const seasonLabel = latestSeason || "All Time";

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
            placeholder="Search players, teams, or stats..."
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
            {!searchLoading && !hasResults && <p className="dash-search-status">No results found</p>}
            {!searchLoading && hasResults && (
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
                {rosters.length > 0 && (
                  <div className="dash-search-group">
                    <div className="dash-search-group-title">Teams</div>
                    {rosters.slice(0, 5).map((r) => (
                      <div
                        key={r.id}
                        className="dash-search-item"
                        onClick={() => { setSearchQuery(""); navigate(`/rosters/${r.id}`); }}
                      >
                        <div className="dash-search-avatar">{r.label.charAt(0)}</div>
                        <div className="dash-search-item-info">
                          <strong>{r.label}</strong>
                          {r.meta?.starters && <span>{r.meta.starters.join(", ")}</span>}
                        </div>
                        <span className="dash-search-type">Team</span>
                      </div>
                    ))}
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
            <span className="dash-standings-badge">Coming Soon</span>
          </div>
          <ol className="dash-standings-list">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={`slot-${i}`}>
                <span className="dash-standings-rank">{i + 1}</span>
                <div className="dash-standings-bar" />
                <span className="dash-standings-pts">&mdash;</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* 4. Featured — highest avg score, current season */}
      <section className="dash-featured">
        <div className="dash-featured-header">
          <div>
            <span className="dash-label">Featured &middot; {seasonLabel}</span>
            <h2>Top Rated</h2>
          </div>
        </div>
        {topLoading && <p className="dash-empty">Loading...</p>}
        {!topLoading && topScorers?.rows?.length ? (
          <div className="featured-cards">
            {topScorers.rows.slice(0, 6).map((row, index) => {
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
                    <span className="card-team">{row.teams[0] || "—"}</span>
                    <span className="card-value">
                      {formatStat(row.value, topScorers.metric.format, topScorers.mode)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          !topLoading && <p className="dash-empty">No data available.</p>
        )}

        {/* Player search inside featured panel */}
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
              {!playerSearchLoading && playerResults.length === 0 && (
                <p className="dash-empty">No players found.</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
