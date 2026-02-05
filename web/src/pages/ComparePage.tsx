import { useEffect, useMemo, useState } from "react";
import type { SearchResult, StatCategory, StatOption } from "../types/api";
import { api } from "../api";
import ComparePanel from "../components/ComparePanel";
import StatPicker from "../components/StatPicker";

const DEFAULT_COMPARE_STATS = ["goals", "assists", "saves", "demos"];

export type ComparePageProps = {
  filters: { season: string; split: string; event: string };
  compareMode: "players" | "rosters";
  compareSelection: SearchResult[];
  onRemoveCompare: (id: string) => void;
  statOptions: StatOption[];
};

export default function ComparePage({
  filters,
  compareMode,
  compareSelection,
  onRemoveCompare,
  statOptions
}: ComparePageProps) {
  const [compareMetrics, setCompareMetrics] = useState<string[]>(DEFAULT_COMPARE_STATS);
  const [statCategories, setStatCategories] = useState<StatCategory[]>([]);

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
    return compareMetrics
      .filter((key) => !coreKeys.has(key))
      .map((key) => catMap.get(key))
      .filter((stat): stat is StatOption => Boolean(stat));
  }, [compareMetrics, coreKeys, allCategoryStats]);

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

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">RLCS SSA Database</p>
          <h1>Head-to-Head</h1>
        </div>
      </header>

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
                  <span>&times;</span>
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
            <StatPicker
              categories={statCategories}
              selected={compareMetrics}
              onToggle={toggleCompareMetric}
            />
          </div>
          {extraMetrics.length > 0 && (
            <div className="stat-extra-chips">
              {extraMetrics.map((stat) => (
                <button
                  key={stat.key}
                  type="button"
                  className="chip"
                  onClick={() => toggleCompareMetric(stat.key)}
                >
                  {stat.label}
                  <span>&times;</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <main className="main-grid">
        <section className="panel compare-panel" style={{ animationDelay: "240ms" }}>
          <ComparePanel
            compareMode={compareMode}
            compareSelection={compareSelection}
            onRemove={onRemoveCompare}
            filters={filters}
            statOptions={allStatOptions}
            compareMetrics={compareMetrics}
          />
        </section>
      </main>
    </div>
  );
}
