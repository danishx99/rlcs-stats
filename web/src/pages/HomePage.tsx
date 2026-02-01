import { useEffect, useMemo, useState } from "react";
import type { FeaturedResponse, LeaderboardResponse, SearchResult, StatOption } from "../types/api";
import { api } from "../api";
import Leaderboard from "../components/Leaderboard";
import FeaturedPanel from "../components/FeaturedPanel";
import ComparePanel from "../components/ComparePanel";

const DEFAULT_COMPARE_STATS = ["goals", "assists", "saves", "demos"];

export type HomePageProps = {
  searchQuery: string;
  searchLoading: boolean;
  searchError: string | null;
  filters: { season: string; split: string; event: string };
  compareMode: "players" | "rosters";
  compareSelection: SearchResult[];
  onRemoveCompare: (id: string) => void;
  statOptions: StatOption[];
  featuredOptions: StatOption[];
};

export default function HomePage({
  searchQuery,
  searchLoading,
  searchError,
  filters,
  compareMode,
  compareSelection,
  onRemoveCompare,
  statOptions,
  featuredOptions
}: HomePageProps) {
  const [leaderStat, setLeaderStat] = useState<string>("score");
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [leaderLoading, setLeaderLoading] = useState(false);
  const [featuredStat, setFeaturedStat] = useState<string>("least_grounded");
  const [featured, setFeatured] = useState<FeaturedResponse | null>(null);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [compareMetrics, setCompareMetrics] = useState<string[]>(DEFAULT_COMPARE_STATS);

  const statMap = useMemo(() => {
    const map = new Map(statOptions.map((option) => [option.key, option]));
    const defaultStat = statOptions.find((option) => option.key === "score")?.key;
    const fallback = defaultStat ?? statOptions[0]?.key ?? "score";
    return { map, fallback };
  }, [statOptions]);

  const compareStatsList = useMemo(
    () => statOptions.filter((option) => option.key !== "series_played"),
    [statOptions]
  );

  const toggleCompareMetric = (key: string) => {
    setCompareMetrics((prev) => {
      if (prev.includes(key)) {
        return prev.filter((metric) => metric !== key);
      }
      return [...prev, key];
    });
  };

  useEffect(() => {
    if (statOptions.length === 0) return;
    if (!statMap.map.has(leaderStat)) {
      setLeaderStat(statMap.fallback);
    }
  }, [leaderStat, statMap, statOptions.length]);

  useEffect(() => {
    if (!featuredOptions.length) return;
    const map = new Map(featuredOptions.map((option) => [option.key, option]));
    if (!map.has(featuredStat)) {
      setFeaturedStat(featuredOptions[0]?.key ?? "least_grounded");
    }
  }, [featuredOptions, featuredStat]);

  useEffect(() => {
    async function loadLeaderboard() {
      if (!leaderStat) return;
      setLeaderLoading(true);
      try {
        const response = await api.statsTop({
          metric: leaderStat,
          mode: "avg",
          season: filters.season || undefined,
          split: filters.split || undefined,
          event: filters.event || undefined,
          limit: 10
        });
        setLeaderboard(response);
      } catch (error) {
        console.error(error);
      } finally {
        setLeaderLoading(false);
      }
    }

    loadLeaderboard();
  }, [filters.event, filters.season, filters.split, leaderStat]);

  useEffect(() => {
    async function loadFeatured() {
      if (!featuredStat) return;
      setFeaturedLoading(true);
      try {
        const response = await api.featured({
          metric: featuredStat,
          limit: 6,
          season: filters.season || undefined,
          split: filters.split || undefined,
          event: filters.event || undefined
        });
        setFeatured(response);
      } catch (error) {
        console.error(error);
      } finally {
        setFeaturedLoading(false);
      }
    }

    loadFeatured();
  }, [featuredStat, filters.event, filters.season, filters.split]);

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">RLCS Intel Grid</p>
          <h1>RLCS Stats Command</h1>
          <p className="lede">
            Industrial-grade scouting dashboards for SSA 21/22 + 22/23. Search players, compare
            rosters, and surface stat leaders with precision filtering.
          </p>
        </div>
      </header>

      {searchQuery && searchLoading ? (
        <p className="empty">Searching...</p>
      ) : searchQuery && searchError ? (
        <p className="empty">{searchError}</p>
      ) : null}

      <section className="control-row">
        <div className="panel mode-panel" style={{ animationDelay: "200ms" }}>
          <div className="panel-header">
            <div>
              <p className="panel-label">Compare</p>
              <h2>Head-to-Head</h2>
            </div>
          </div>
          <div className="compare-chips">
            {compareSelection.length === 0 ? (
              <p className="empty">Add 2-6 entries from search results.</p>
            ) : (
              compareSelection.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="chip"
                  onClick={() => onRemoveCompare(entry.id)}
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
          <ComparePanel
            compareMode={compareMode}
            compareSelection={compareSelection}
            onRemove={onRemoveCompare}
            filters={filters}
            statOptions={statOptions}
            compareMetrics={compareMetrics}
          />
        </section>

        <section className="panel leaderboard-panel" style={{ animationDelay: "280ms" }}>
          <div className="panel-header">
            <div>
              <p className="panel-label">Top 10</p>
              <h2>Leaderboard</h2>
            </div>
            <select value={leaderStat} onChange={(event) => setLeaderStat(event.target.value)}>
              {statOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {leaderLoading && <p className="empty">Loading leaderboard...</p>}
          {!leaderLoading && leaderboard?.rows?.length ? (
            <Leaderboard data={leaderboard} />
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
            <select value={featuredStat} onChange={(event) => setFeaturedStat(event.target.value)}>
              {featuredOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {featuredLoading && <p className="empty">Loading featured players...</p>}
          {!featuredLoading && featured?.rows?.length ? (
            <FeaturedPanel data={featured} />
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
      </main>
    </div>
  );
}
