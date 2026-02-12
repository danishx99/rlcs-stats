import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { LeaderboardResponse, MetaColumnsResponse, MetaResponse } from "../types/api";
import Leaderboard from "../components/Leaderboard";
import StatPicker from "../components/StatPicker";

export default function StatPage() {
  const { statKey } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const type = searchParams.get("type") === "team" ? "team" : "player";
  const mode = searchParams.get("mode") === "total" ? "total" : "avg";
  const sort = searchParams.get("sort") === "asc" ? "asc" : "desc";
  const season = searchParams.get("season") ?? "";
  const split = searchParams.get("split") ?? "";
  const event = searchParams.get("event") ?? "";

  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [columns, setColumns] = useState<MetaColumnsResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load meta (cascading filters)
  useEffect(() => {
    let cancelled = false;
    api.meta({ season: season || undefined, split: split || undefined }).then((res) => {
      if (!cancelled) setMeta(res);
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [season, split]);

  // Load stat categories
  useEffect(() => {
    let cancelled = false;
    api.metaColumns().then((res) => {
      if (!cancelled) setColumns(res);
    }).catch(console.error);
    return () => { cancelled = true; };
  }, []);

  // Load leaderboard
  useEffect(() => {
    if (!statKey) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.statsTop({
      metric: statKey,
      mode,
      type,
      sort: sort === "asc" ? "asc" : undefined,
      season: season || undefined,
      split: split || undefined,
      event: event || undefined,
      limit: 10
    }).then((res) => {
      if (!cancelled) setLeaderboard(res);
    }).catch((err) => {
      console.error(err);
      if (!cancelled) setError("Failed to load leaderboard");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [statKey, mode, type, sort, season, split, event]);

  const updateParam = useCallback((key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      if (key === "season") {
        next.delete("split");
        next.delete("event");
      } else if (key === "split") {
        next.delete("event");
      }
      return next;
    });
  }, [setSearchParams]);

  const handleStatChange = useCallback((key: string) => {
    const params = new URLSearchParams(searchParams);
    navigate(`/stats/${encodeURIComponent(key)}?${params.toString()}`);
  }, [navigate, searchParams]);

  const categories = columns?.categories ?? [];
  const selectedStatLabel = useMemo(() => {
    for (const cat of categories) {
      const found = cat.stats.find((s) => s.key === statKey);
      if (found) return found.label;
    }
    return leaderboard?.metric?.label ?? statKey ?? "Stat";
  }, [categories, statKey, leaderboard]);

  const typeLabel = type === "team" ? "Teams" : "Players";
  const modeLabel = mode === "total" ? "Total" : "Per Game";
  const sortLabel = sort === "asc" ? "Lowest" : "Top";

  return (
    <div className="page page-no-nav">
      <button className="ghost back-button" onClick={() => navigate("/")}>
        &larr; Back to Dashboard
      </button>

      <div className="stat-page-header">
        <h1>{selectedStatLabel}</h1>
        <div className="stat-page-subtitle">
          {sortLabel} 10 {typeLabel} &middot; {modeLabel}
        </div>
      </div>

      <div className="stat-page-controls">
        <div className="tabs">
          <button
            type="button"
            className={`tab${type === "player" ? " active" : ""}`}
            onClick={() => updateParam("type", "")}
          >
            Players
          </button>
          <button
            type="button"
            className={`tab${type === "team" ? " active" : ""}`}
            onClick={() => updateParam("type", "team")}
          >
            Teams
          </button>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={`tab${mode === "avg" ? " active" : ""}`}
            onClick={() => updateParam("mode", "")}
          >
            Per Game
          </button>
          <button
            type="button"
            className={`tab${mode === "total" ? " active" : ""}`}
            onClick={() => updateParam("mode", "total")}
          >
            Total
          </button>
        </div>

        <StatPicker
          categories={categories}
          selected={statKey ? [statKey] : []}
          onToggle={handleStatChange}
          single
          dropdown
          triggerLabel={selectedStatLabel}
        />

        <button
          type="button"
          className="sort-toggle"
          title={sort === "desc" ? "Descending (highest first)" : "Ascending (lowest first)"}
          onClick={() => updateParam("sort", sort === "desc" ? "asc" : "")}
        >
          {sort === "desc" ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v10M5 10l3 3 3-3" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 13V3M5 6l3-3 3 3" />
            </svg>
          )}
        </button>

        <div className="stat-page-filters">
          <select
            value={season}
            onChange={(e) => updateParam("season", e.target.value)}
          >
            <option value="">All Seasons</option>
            {(meta?.seasons ?? []).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={split}
            onChange={(e) => updateParam("split", e.target.value)}
            disabled={!season}
          >
            <option value="">All Splits</option>
            {(meta?.splits ?? []).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={event}
            onChange={(e) => updateParam("event", e.target.value)}
            disabled={!season}
          >
            <option value="">All Events</option>
            {(meta?.events ?? []).map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="section-divider" />

      {loading && <div className="loading">Loading leaderboard...</div>}
      {error && <div className="error">{error}</div>}
      {!loading && !error && leaderboard && <Leaderboard data={leaderboard} />}
      {!loading && !error && !leaderboard && (
        <div className="empty-state">No leaderboard data.</div>
      )}
    </div>
  );
}
