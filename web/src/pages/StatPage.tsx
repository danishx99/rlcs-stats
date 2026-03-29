import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { LeaderboardResponse, MetaColumnsResponse, MetaResponse } from "../types/api";
import Leaderboard from "../components/Leaderboard";
import StatPicker from "../components/StatPicker";
import { isInternationalEvent, sortEventsLanLast } from "../utils/events";
import PanelState from "../components/ui/PanelState";
import SkeletonBlock from "../components/ui/SkeletonBlock";

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
  const gameMode = searchParams.get("gameMode") ?? "3s";
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "10", 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 10;
  const includeLans = searchParams.get("includeLans") === "1";
  const teamsDisabled = gameMode === "1s";

  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [columns, setColumns] = useState<MetaColumnsResponse | null>(null);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [columnsError, setColumnsError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const internationalEvents = meta?.internationalEvents ?? [];
  const forceIncludeLansForEvent = gameMode === "3s" && Boolean(event) && isInternationalEvent(event, internationalEvents);
  const effectiveIncludeLans = includeLans || forceIncludeLansForEvent;
  const scope = gameMode === "3s" && !effectiveIncludeLans ? "regional" : "";
  const tier = gameMode === "3s" && !effectiveIncludeLans ? "none" : "";

  // Load meta (cascading filters)
  useEffect(() => {
    let cancelled = false;
    setMetaLoading(true);
    setMetaError(null);
    api.meta({
      gameMode: gameMode || undefined,
      scope: scope || undefined,
      tier: tier || undefined,
      season: season || undefined,
      split: split || undefined
    }).then((res) => {
      if (!cancelled) setMeta(res);
    }).catch((metaLoadError) => {
      console.error(metaLoadError);
      if (!cancelled) {
        setMeta(null);
        setMetaError("Failed to load filter options.");
      }
    }).finally(() => {
      if (!cancelled) setMetaLoading(false);
    });
    return () => { cancelled = true; };
  }, [gameMode, scope, season, split, tier]);

  // Load stat categories
  useEffect(() => {
    let cancelled = false;
    setColumnsLoading(true);
    setColumnsError(null);
    api.metaColumns().then((res) => {
      if (!cancelled) setColumns(res);
    }).catch((columnsLoadError) => {
      console.error(columnsLoadError);
      if (!cancelled) {
        setColumns(null);
        setColumnsError("Failed to load stat options.");
      }
    }).finally(() => {
      if (!cancelled) setColumnsLoading(false);
    });
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
      ssaOnly: type === "player" ? "1" : undefined,
      gameMode: gameMode || undefined,
      scope: scope || undefined,
      tier: tier || undefined,
      season: season || undefined,
      split: split || undefined,
      event: event || undefined,
      limit
    }).then((res) => {
      if (!cancelled) setLeaderboard(res);
    }).catch((err) => {
      console.error(err);
      if (!cancelled) setError("Failed to load leaderboard");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [event, gameMode, limit, mode, retryKey, scope, season, sort, split, statKey, tier, type]);

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
      } else if (key === "gameMode") {
        if (value !== "3s") next.delete("includeLans");
        if (value === "1s") next.delete("type");
        next.delete("season");
        next.delete("split");
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
  const eventOptions = useMemo(
    () => sortEventsLanLast(meta?.events ?? [], internationalEvents),
    [internationalEvents, meta?.events]
  );
  const selectedStatLabel = useMemo(() => {
    for (const cat of categories) {
      const found = cat.stats.find((s) => s.key === statKey);
      if (found) return found.label;
    }
    return leaderboard?.metric?.label ?? statKey ?? "Stat";
  }, [categories, statKey, leaderboard]);
  const statExists = useMemo(() => {
    if (!statKey) return false;
    return categories.some((category) => category.stats.some((stat) => stat.key === statKey));
  }, [categories, statKey]);

  const typeLabel = type === "team" ? "Teams" : "Players";
  const modeLabel = mode === "total" ? "Total" : "Per Game";
  const sortLabel = sort === "asc" ? "Lowest" : "Top";
  const showingAll = limit >= 50;
  const targetLimit = showingAll ? 10 : 50;
  const limitLabel = showingAll ? "Top 50" : `Top ${limit}`;

  return (
    <div className="page page-no-nav">
      <button className="ghost back-button" onClick={() => navigate("/")}>
        &larr; Back to Dashboard
      </button>

      <div>
        <h1 className="page-heading" style={{ marginBottom: 6 }}>{selectedStatLabel}</h1>
        <div className="page-heading-sub">
          {sortLabel} {limitLabel} {typeLabel} &middot; {modeLabel}
        </div>
      </div>

      <div className="stat-page-controls">
        <div className="stat-page-toggles">
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
              disabled={teamsDisabled}
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

          {columnsLoading ? (
            <button type="button" className="ghost" disabled aria-busy="true">
              Loading stats...
            </button>
          ) : (
            <StatPicker
              categories={categories}
              selected={statKey ? [statKey] : []}
              onToggle={handleStatChange}
              single
              dropdown
              triggerLabel={selectedStatLabel}
            />
          )}

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

          <button
            type="button"
            className="ghost"
            onClick={() => updateParam("limit", String(targetLimit))}
          >
            {showingAll ? "Show Top 10" : "See All"}
          </button>
        </div>

        <div className="stat-page-filters">
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={effectiveIncludeLans}
              onChange={(e) => updateParam("includeLans", e.target.checked ? "1" : "")}
              disabled={gameMode !== "3s" || forceIncludeLansForEvent}
            />
            Include LAN Events
          </label>
          <select
            value={gameMode}
            onChange={(e) => updateParam("gameMode", e.target.value)}
          >
            {(meta?.modes ?? ["1s", "2s", "3s"]).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
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
            onChange={(e) => {
              const selectedEvent = e.target.value;
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (selectedEvent) {
                  next.set("event", selectedEvent);
                } else {
                  next.delete("event");
                }
                if (gameMode === "3s" && selectedEvent && isInternationalEvent(selectedEvent, internationalEvents)) {
                  next.set("includeLans", "1");
                }
                return next;
              });
            }}
            disabled={!season}
          >
            <option value="">All Events</option>
            {eventOptions.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="section-divider" />

      {metaLoading && !meta ? <PanelState state="loading" message="Loading filter options..." /> : null}
      {metaError ? <PanelState state="error" message={metaError} /> : null}
      {columnsError ? <PanelState state="error" message={columnsError} /> : null}
      {!columnsLoading && categories.length > 0 && !statExists ? (
        <PanelState state="empty" message="That stat does not exist. Pick a valid stat from the picker." />
      ) : null}
      {loading ? (
        <div role="status" aria-busy="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={`lb-skel-${i}`} className="skel-leaderboard-row">
              <SkeletonBlock width={24} height={24} rounded="pill" />
              <SkeletonBlock width={36} height={36} rounded="pill" />
              <SkeletonBlock height={14} width={`${160 - i * 8}px`} />
              <div style={{ marginLeft: "auto" }}>
                <SkeletonBlock height={14} width={50} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {!loading && error ? (
        <PanelState
          state="error"
          message={error}
          onRetry={() => setRetryKey((value) => value + 1)}
        />
      ) : null}
      {!loading && !error && leaderboard ? (
        <Leaderboard data={leaderboard} entityType={type} showSecondaryValue />
      ) : null}
      {!loading && !error && !leaderboard ? (
        <PanelState state="empty" message="No leaderboard data." />
      ) : null}
    </div>
  );
}
