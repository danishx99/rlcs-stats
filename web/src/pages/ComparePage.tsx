import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SearchResult, StatCategory, StatOption } from "../types/api";
import { api } from "../api";
import type { Filters } from "../types/ui";
import { useMeta } from "../hooks/useMeta";
import { proxyImageUrl, DEFAULT_PLAYER_PHOTO, DEFAULT_TEAM_LOGO } from "../utils/normalize";
import ComparePanel from "../components/ComparePanel";
import StatPicker from "../components/StatPicker";
import TeamNameWithLogo from "../components/TeamNameWithLogo";
import PlayerNameWithPhoto from "../components/PlayerNameWithPhoto";
import { isInternationalEvent, sortEventsLanLast } from "../utils/events";

const DEFAULT_COMPARE_STATS = ["goals", "assists", "saves", "demos"];
const SEARCH_DEBOUNCE_MS = 500;
const DEFAULT_FILTERS: Filters = {
  mode: "3s",
  scope: "regional",
  tier: "none",
  season: "",
  split: "",
  event: ""
};

export default function ComparePage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [compareMode, setCompareMode] = useState<"players" | "rosters">("players");
  const [compareSelection, setCompareSelection] = useState<SearchResult[]>([]);
  const [compareMetrics, setCompareMetrics] = useState<string[]>(DEFAULT_COMPARE_STATS);
  const [statCategories, setStatCategories] = useState<StatCategory[]>([]);
  const [addedExtras, setAddedExtras] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const { meta } = useMeta(filters);
  const statOptions = meta?.statOptions ?? [];

  const compareStatsList = useMemo(
    () => statOptions.filter((option) => option.key !== "series_played"),
    [statOptions]
  );
  const internationalEvents = meta?.internationalEvents ?? [];
  const eventOptions = useMemo(
    () => sortEventsLanLast(meta?.events ?? [], internationalEvents),
    [internationalEvents, meta?.events]
  );
  const includeLans = filters.mode === "3s" && !(filters.scope === "regional" && filters.tier === "none");

  const toggleCompareMetric = (key: string) => {
    setCompareMetrics((prev) => {
      if (prev.includes(key)) {
        return prev.filter((metric) => metric !== key);
      }
      return [...prev, key];
    });
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
        const response = await api.search({
          q: trimmed,
          limit: 8,
          gameMode: filters.mode || undefined,
          scope: filters.scope || undefined,
          tier: filters.tier || undefined,
          season: filters.season || undefined,
          split: filters.split || undefined,
          event: filters.event || undefined
        });
        setSearchResults([...response.players, ...response.rosters]);
      } catch (error) {
        console.error(error);
      } finally {
        setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [filters.event, filters.mode, filters.scope, filters.season, filters.split, filters.tier, searchQuery]);

  const filteredResults = useMemo(() => {
    if (!lockedType) return searchResults;
    return searchResults.filter((item) => item.type === lockedType);
  }, [searchResults, lockedType]);

  const handleAddResult = (item: SearchResult) => {
    if (item.type === "stat") return;
    setCompareMode(item.type === "player" ? "players" : "rosters");
    setCompareSelection((prev) => {
      if (prev.some((existing) => existing.id === item.id)) return prev;
      return [...prev, item];
    });
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
                  const image = proxyImageUrl(item.meta?.photoUrl) ?? proxyImageUrl(
                    item.type === "roster" ? DEFAULT_TEAM_LOGO : DEFAULT_PLAYER_PHOTO
                  )!;
                  const subtitle = item.type === "player"
                    ? item.meta?.realName ?? ""
                    : item.meta?.starters?.join(" / ") ?? "";
                  return (
                    <div
                      key={item.id}
                      className={`dash-search-item compare-search-item${already ? " compare-search-item--added" : ""}`}
                      onClick={() => !already && handleAddResult(item)}
                    >
                      <div className={`dash-search-avatar${item.type === "roster" ? " dash-search-avatar--logo" : ""}`}>
                        <img src={image} alt="" />
                      </div>
                      <div className="dash-search-item-info">
                        <strong>{item.label}</strong>
                        {subtitle && <span>{subtitle}</span>}
                      </div>
                      <span className="dash-search-type">{item.type === "player" ? "Player" : "Team"}</span>
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
                  onClick={() => setCompareSelection((prev) => prev.filter((item) => item.id !== entry.id))}
                >
                  {entry.type === "player" ? (
                    <PlayerNameWithPhoto
                      name={entry.label}
                      playerId={entry.id}
                      photoUrl={entry.meta?.photoUrl ?? null}
                      link={false}
                    />
                  ) : (
                    <TeamNameWithLogo
                      team={entry.label}
                      logoUrl={entry.meta?.photoUrl ?? null}
                      link={false}
                    />
                  )}
                  <span>&times;</span>
                </button>
              ))}
              <button
                type="button"
                className="ghost"
                style={{ marginLeft: "auto" }}
                onClick={() => setCompareSelection([])}
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
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={includeLans}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    scope: e.target.checked ? "" : "regional",
                    tier: e.target.checked ? "" : "none",
                    season: "",
                    split: "",
                    event: ""
                  })
                }
                disabled={filters.mode !== "3s"}
              />
              Include LAN Events
            </label>
            <select
              value={filters.mode}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  mode: e.target.value,
                  scope: "regional",
                  tier: "none",
                  season: "",
                  split: "",
                  event: ""
                })
              }
            >
              {(meta?.modes ?? ["1s", "2s", "3s"]).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={filters.season}
              onChange={(e) =>
                setFilters({ ...filters, season: e.target.value, split: "", event: "" })
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
                setFilters({ ...filters, split: e.target.value, event: "" })
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
              onChange={(e) => {
                const selectedEvent = e.target.value;
                const forceIncludeLan = filters.mode === "3s" && selectedEvent && isInternationalEvent(selectedEvent, internationalEvents);
                setFilters({
                  ...filters,
                  event: selectedEvent,
                  scope: forceIncludeLan ? "" : filters.scope,
                  tier: forceIncludeLan ? "" : filters.tier
                });
              }}
              disabled={!filters.season || !filters.split}
            >
              <option value="">All Events</option>
              {eventOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <ComparePanel
          compareMode={compareMode}
          compareSelection={compareSelection}
          onRemove={(id) => setCompareSelection((prev) => prev.filter((item) => item.id !== id))}
          filters={filters}
          statOptions={allStatOptions}
          compareMetrics={compareMetrics}
        />
      </div>
    </div>
  );
}
