import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { MetaColumnsResponse, MetaResponse } from "../types/api";
import StatPicker from "../components/StatPicker";
import ArenaFilter from "../components/ArenaFilter";
import StatCardGrid from "../components/StatCardGrid";
import { isInternationalEvent, sortEventsLanLast } from "../utils/events";
import PanelState from "../components/ui/PanelState";
import SkeletonBlock from "../components/ui/SkeletonBlock";
import { useStatSelection } from "../hooks/useStatSelection";
import { useStatLeaderboards } from "../hooks/useStatLeaderboards";
import { useShare } from "../hooks/useShare";
import { MILESTONE_STAT_KEYS } from "../utils/stats";

export default function StatPage() {
  const { statKey } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const type = searchParams.get("type") === "team" ? "team" : "player";
  const mode = searchParams.get("mode") === "avg" ? "avg" : "total";
  const sort = searchParams.get("sort") === "asc" ? "asc" : "desc";
  const season = searchParams.get("season") ?? "";
  const split = searchParams.get("split") ?? "";
  const event = searchParams.get("event") ?? "";
  const gameMode = searchParams.get("gameMode") ?? "3s";
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "10", 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 10;
  const includeLans = searchParams.get("includeLans") === "1";
  const arenaParam = searchParams.get("arena") ?? "";
  const teamsDisabled = gameMode === "1s";

  // Minimum games threshold for Per Game mode. Absent param → default 25.
  // Explicit `minGames=0` means "All" (no threshold).
  const minGamesRaw = searchParams.get("minGames");
  const minGames = minGamesRaw === null
    ? 25
    : Math.max(0, Number.parseInt(minGamesRaw, 10) || 0);
  const minGamesActive = mode === "avg" ? minGames : 0;

  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [columns, setColumns] = useState<MetaColumnsResponse | null>(null);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [columnsError, setColumnsError] = useState<string | null>(null);

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

  const categories = columns?.categories ?? [];

  // Build label lookup and valid-key set from categories.
  const { statLabels, validKeys } = useMemo(() => {
    const labels = new Map<string, string>();
    const keys = new Set<string>();
    for (const cat of categories) {
      for (const s of cat.stats) {
        labels.set(s.key, s.label);
        keys.add(s.key);
      }
    }
    return { statLabels: labels, validKeys: keys };
  }, [categories]);

  // In team mode, milestone stats have no clean team-level definition. Drop
  // them from validKeys so useStatSelection silently filters them out of the
  // URL the same way it handles bogus keys.
  const effectiveValidKeys = useMemo(() => {
    if (type !== "team") return validKeys;
    const next = new Set<string>();
    validKeys.forEach((key) => {
      if (!MILESTONE_STAT_KEYS.has(key)) next.add(key);
    });
    return next;
  }, [validKeys, type]);

  // Until categories load, treat validKeys as unknown (null) so we don't
  // erroneously strip stats from the URL on initial mount.
  const validKeysOrNull = !columnsLoading && categories.length > 0 ? effectiveValidKeys : null;

  // If the URL anchor is a milestone stat while in Teams mode, re-anchor to
  // the default ("score") so the page renders cleanly. Preserve all other
  // query params.
  useEffect(() => {
    if (type !== "team") return;
    if (!statKey) return;
    if (!MILESTONE_STAT_KEYS.has(statKey)) return;
    const search = searchParams.toString();
    navigate(`/stats/score${search ? `?${search}` : ""}`, { replace: true });
  }, [type, statKey, searchParams, navigate]);

  const { orderedStats, toggleStat, removeStat, isAtCap } = useStatSelection({
    statKey,
    searchParams,
    setSearchParams,
    navigate,
    validKeys: validKeysOrNull,
  });

  // Validate arena against meta.arenas; silently drop invalid values from the URL.
  const arenas = meta?.arenas ?? [];
  const arenaIsValid = arenaParam === "" || arenas.includes(arenaParam);
  const effectiveArena = arenaIsValid ? arenaParam : "";

  useEffect(() => {
    if (!meta) return;
    if (arenaParam === "") return;
    if (arenas.includes(arenaParam)) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("arena");
      return next;
    }, { replace: true });
  }, [meta, arenaParam, arenas, setSearchParams]);

  const { dataByKey, loadingByKey, errorByKey } = useStatLeaderboards(orderedStats, {
    type,
    mode,
    sort,
    limit,
    gameMode,
    scope,
    tier,
    season,
    split,
    event,
    arena: effectiveArena,
    minGames: minGamesActive,
  });

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

  const eventOptions = useMemo(
    () => sortEventsLanLast(meta?.events ?? [], internationalEvents),
    [internationalEvents, meta?.events]
  );

  const statExists = useMemo(() => {
    if (!statKey) return false;
    if (categories.length === 0) return true; // unknown until loaded
    return categories.some((category) => category.stats.some((stat) => stat.key === statKey));
  }, [categories, statKey]);

  const typeLabel = type === "team" ? "Teams" : "Players";
  const modeLabel = mode === "total" ? "Total" : "Per Game";
  const sortLabel = sort === "asc" ? "Lowest" : "Top";
  const showingAll = limit >= 50;
  const targetLimit = showingAll ? 10 : 50;
  const limitLabel = showingAll ? "Top 50" : `Top ${limit}`;

  // Subheading describes active filter scope.
  const subheadingParts = [
    `${sortLabel} ${limitLabel} ${typeLabel}`,
    modeLabel,
    season || null,
    split || null,
    event || null,
    gameMode,
    gameMode === "3s" ? (effectiveIncludeLans ? "All events" : "Regional only") : null,
    effectiveArena || null,
    mode === "avg" ? (minGamesActive > 0 ? `${minGamesActive}+ games` : "All games") : null,
  ].filter((part): part is string => Boolean(part));

  const { share: shareView, busy: shareBusy, message: shareMessage } = useShare();
  const subheadingText = subheadingParts.join(" · ");
  const handleShare = () => {
    void shareView({
      title: "RLCS Stats · Leaderboards",
      text: subheadingText,
      url: window.location.href,
    });
  };

  const disabledKeys = useMemo(() => {
    if (!isAtCap) return undefined;
    const disabled = new Set<string>();
    for (const cat of categories) {
      for (const s of cat.stats) {
        if (!orderedStats.includes(s.key)) disabled.add(s.key);
      }
    }
    return disabled;
  }, [categories, isAtCap, orderedStats]);

  return (
    <div className="page page-no-nav">
      <button className="ghost back-button" onClick={() => navigate("/")}>
        &larr; Back to Dashboard
      </button>

      <div>
        <h1 className="page-heading" style={{ marginBottom: 10 }}>Leaderboards</h1>
        <div className="page-heading-sub" style={{ marginTop: 8 }}>
          {subheadingParts.join(" · ")}
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
              onClick={() => updateParam("mode", "avg")}
            >
              Per Game
            </button>
            <button
              type="button"
              className={`tab${mode === "total" ? " active" : ""}`}
              onClick={() => updateParam("mode", "")}
            >
              Total
            </button>
          </div>

          {mode === "avg" ? (
            <MinGamesControl
              value={minGames}
              onChange={(next) => {
                // Default is 25 when param is absent. Encode the URL accordingly:
                // - 25 → delete param (default)
                // - 0  → set to "0" (explicit "All", distinguishable from absent)
                // - N  → set to N
                if (next === 25) {
                  updateParam("minGames", "");
                } else {
                  updateParam("minGames", String(next));
                }
              }}
            />
          ) : null}

          {columnsLoading ? (
            <button type="button" className="ghost" disabled aria-busy="true">
              Loading stats...
            </button>
          ) : (
            <StatPicker
              categories={categories}
              selected={orderedStats}
              onToggle={toggleStat}
              dropdown
              disabledKeys={disabledKeys}
              hiddenKeys={type === "team" ? (MILESTONE_STAT_KEYS as Set<string>) : undefined}
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

          <button
            type="button"
            className="event-share-button"
            onClick={handleShare}
            disabled={shareBusy}
          >
            {shareBusy ? "Sharing..." : "Share"}
          </button>
          {shareMessage ? <span className="event-share-message">{shareMessage}</span> : null}
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
          <ArenaFilter
            arenas={arenas}
            value={effectiveArena}
            onChange={(next) => updateParam("arena", next)}
          />
        </div>
      </div>

      <div className="section-divider" />

      {metaLoading && !meta ? <PanelState state="loading" message="Loading filter options..." /> : null}
      {metaError ? <PanelState state="error" message={metaError} /> : null}
      {columnsError ? <PanelState state="error" message={columnsError} /> : null}
      {!columnsLoading && categories.length > 0 && !statExists ? (
        <PanelState state="empty" message="That stat does not exist. Pick a valid stat from the picker." />
      ) : null}

      {columnsLoading && orderedStats.length === 0 ? (
        <div role="status" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
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

      {statExists && orderedStats.length > 0 ? (
        <StatCardGrid
          orderedStats={orderedStats}
          dataByKey={dataByKey}
          loadingByKey={loadingByKey}
          errorByKey={errorByKey}
          statLabels={statLabels}
          entityType={type}
          onRemove={removeStat}
        />
      ) : null}
    </div>
  );
}

const MIN_GAMES_PRESETS = [
  { label: "All", value: 0 },
  { label: "10+", value: 10 },
  { label: "25+", value: 25 },
  { label: "50+", value: 50 },
  { label: "100+", value: 100 },
];

function MinGamesControl({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div className="min-games-control" role="group" aria-label="Minimum games">
      <span className="min-games-label">Min games</span>
      <div className="tabs">
        {MIN_GAMES_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className={`tab${value === preset.value ? " active" : ""}`}
            onClick={() => onChange(preset.value)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
