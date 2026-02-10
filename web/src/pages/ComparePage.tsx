import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MetaResponse, SearchResult, StatCategory, StatOption } from "../types/api";
import { api } from "../api";
import { proxyImageUrl } from "../utils/normalize";
import ComparePanel from "../components/ComparePanel";
import StatPicker from "../components/StatPicker";

const DEFAULT_COMPARE_STATS = ["goals", "assists", "saves", "demos"];

export type ComparePageProps = {
  filters: { season: string; split: string; event: string };
  onFiltersChange: (f: { season: string; split: string; event: string }) => void;
  meta: MetaResponse | null;
  compareMode: "players" | "rosters";
  compareSelection: SearchResult[];
  onAddCompare: (item: SearchResult) => void;
  onRemoveCompare: (id: string) => void;
  onClearCompare: () => void;
  statOptions: StatOption[];
};

export default function ComparePage({
  filters,
  onFiltersChange,
  meta,
  compareMode,
  compareSelection,
  onAddCompare,
  onRemoveCompare,
  onClearCompare,
  statOptions
}: ComparePageProps) {
  const navigate = useNavigate();
  const [compareMetrics, setCompareMetrics] = useState<string[]>(DEFAULT_COMPARE_STATS);
  const [statCategories, setStatCategories] = useState<StatCategory[]>([]);
  const [addedExtras, setAddedExtras] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

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
    // Track added extras so they stay visible when unchecked
    setAddedExtras((prev) => {
      if (prev.includes(key)) return prev;
      return [...prev, key];
    });
  };

  const coreKeys = useMemo(
    () => new Set(compareStatsList.map((option) => option.key)),
    [compareStatsList]
  );

  const allCategoryStats = useMemo(
    () => statCategories.flatMap((cat) => cat.stats),
    [statCategories]
  );

  const extraMetrics = useMemo(() => {
    const catMap = new Map(allCategoryStats.map((stat) => [stat.key, stat]));
    return addedExtras
      .filter((key) => !coreKeys.has(key))
      .map((key) => catMap.get(key))
      .filter((stat): stat is StatOption => Boolean(stat));
  }, [addedExtras, coreKeys, allCategoryStats]);

  const allStatOptions = useMemo(() => {
    const merged = new Map(statOptions.map((opt) => [opt.key, opt]));
    for (const stat of allCategoryStats) {
      if (!merged.has(stat.key)) merged.set(stat.key, stat);
    }
    return Array.from(merged.values());
  }, [statOptions, allCategoryStats]);

  useEffect(() => {
    api.metaColumns()
      .then((data) => setStatCategories(data.categories))
      .catch((error) => console.error("Failed to load stat categories:", error));
  }, []);

  const lockedType = compareSelection.length > 0
    ? (compareMode === "players" ? "player" : "roster")
    : null;

  // Inline search for adding players/rosters
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const response = await api.search({ q: trimmed, limit: 8 });
        setSearchResults([...response.players, ...response.rosters]);
      } catch (error) {
        console.error(error);
      } finally {
        setSearchLoading(false);
      }
    }, 200);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  const filteredResults = useMemo(() => {
    if (!lockedType) return searchResults;
    return searchResults.filter((item) => item.type === lockedType);
  }, [searchResults, lockedType]);

  const handleAddResult = (item: SearchResult) => {
    onAddCompare(item);
    setSearchQuery("");
  };

  return (
    <div className="page page-no-nav">
      <button className="ghost back-button" onClick={() => navigate("/")}>
        ← Back to Dashboard
      </button>

      <div className="panel compare-setup-card">
        <div className="compare-setup-header">
          <div>
            <p className="panel-label">Compare</p>
            <h1>Head-to-Head</h1>
          </div>
        </div>

        <div className="compare-search-area">
          <div className="compare-search-label">
            {lockedType === "player" ? "Add Players" : lockedType === "roster" ? "Add Teams" : "Add Players or Teams"}
          </div>
          <div className="dash-search-bar compare-search-bar">
            <svg className="dash-search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="M13 13l4 4" />
            </svg>
            <input
              type="text"
              placeholder={lockedType === "player" ? "Search players..." : lockedType === "roster" ? "Search teams..." : "Search players or teams..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="dash-search-clear" onClick={() => setSearchQuery("")}>
                &times;
              </button>
            )}
          </div>
          {searchQuery.trim() && (
            <div className="compare-search-results">
              {searchLoading && <p className="dash-empty">Searching...</p>}
              {!searchLoading && filteredResults.length > 0 &&
                filteredResults.slice(0, 6).map((item) => {
                  const already = compareSelection.some((s) => s.id === item.id);
                  const imgSrc = item.type === "player" ? proxyImageUrl(item.meta?.photoUrl) : null;
                  return (
                    <div
                      key={item.id}
                      className={`compare-search-card${already ? " compare-search-card--added" : ""}`}
                      onClick={() => !already && handleAddResult(item)}
                    >
                      <div className="dash-search-avatar">
                        {imgSrc ? <img src={imgSrc} alt="" /> : item.label.charAt(0).toUpperCase()}
                      </div>
                      <div className="dash-player-card-info">
                        <strong>{item.label}</strong>
                        <span>
                          {item.type === "player" ? item.meta?.realName ?? "" : item.meta?.starters?.join(" / ") ?? ""}
                        </span>
                      </div>
                      <span className="compare-search-type">{item.type}</span>
                      {already && <span className="compare-search-added">Added</span>}
                    </div>
                  );
                })}
              {!searchLoading && filteredResults.length === 0 && (
                <p className="dash-empty">
                  {lockedType === "player" ? "No players found." : lockedType === "roster" ? "No teams found." : "No players or teams found."}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="compare-chips">
          {compareSelection.length === 0 ? (
            <p className="empty">Search and add 2-6 players or teams to compare.</p>
          ) : (
            <>
              {compareSelection.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="chip"
                  onClick={() => onRemoveCompare(entry.id)}
                >
                  {entry.label}
                  <span>&times;</span>
                </button>
              ))}
              <button
                type="button"
                className="ghost"
                style={{ marginLeft: "auto" }}
                onClick={onClearCompare}
              >
                Clear All
              </button>
            </>
          )}
        </div>
      </div>

      <div className="section-divider" />

      <div className="panel compare-metrics-card">
        <div className="panel-header">
          <div>
            <p className="panel-label">Metrics</p>
            <h2>Stats to Compare</h2>
          </div>
          <StatPicker
            categories={statCategories}
            selected={compareMetrics}
            onToggle={toggleCompareMetric}
          />
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
          {extraMetrics.map((stat) => (
            <label key={stat.key} className="stat-toggle">
              <input
                type="checkbox"
                checked={compareMetrics.includes(stat.key)}
                onChange={() => toggleCompareMetric(stat.key)}
              />
              {stat.label}
            </label>
          ))}
        </div>
      </div>

      <div className="section-divider" />

      <div className="panel compare-results-card">
        <div className="panel-header">
          <div>
            <p className="panel-label">Stats View</p>
            <h2>{compareSelection.length < 2 ? (compareMode === "rosters" ? "Team Statistics" : "Player Statistics") : "Head-to-Head Comparison"}</h2>
          </div>
          <div className="profile-filter-row">
            <select
              value={filters.season}
              onChange={(e) =>
                onFiltersChange({ season: e.target.value, split: "", event: "" })
              }
            >
              <option value="">All Seasons</option>
              {(meta?.seasons ?? []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filters.split}
              onChange={(e) =>
                onFiltersChange({ season: filters.season, split: e.target.value, event: "" })
              }
              disabled={!filters.season}
            >
              <option value="">All Splits</option>
              {(meta?.splits ?? []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filters.event}
              onChange={(e) =>
                onFiltersChange({ season: filters.season, split: filters.split, event: e.target.value })
              }
              disabled={!filters.season || !filters.split}
            >
              <option value="">All Events</option>
              {(meta?.events ?? []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <ComparePanel
          compareMode={compareMode}
          compareSelection={compareSelection}
          onRemove={onRemoveCompare}
          filters={filters}
          statOptions={allStatOptions}
          compareMetrics={compareMetrics}
        />
      </div>
    </div>
  );
}
