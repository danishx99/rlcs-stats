import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { EventBracket, EventDetail, EventTeam, LeaderboardResponse, MetaResponse, StatCategory, StatOption } from "../types/api";
import { formatDate } from "../utils/date";
import { buildEventPath } from "../utils/event-routing";
import { sortEventsLanLast } from "../utils/events";
import PanelState from "../components/ui/PanelState";
import SkeletonBlock from "../components/ui/SkeletonBlock";
import PageBackActions from "../components/PageBackActions";
import { useShare } from "../hooks/useShare";
import EventBracketPanel from "../components/event/EventBracketPanel";
import EventLeaderboardsPanel from "../components/event/EventLeaderboardsPanel";
import EventSearchWidget from "../components/event/EventSearchWidget";
import { useStatLeaderboards } from "../hooks/useStatLeaderboards";

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
const TOP_TEAMS_LIMIT = 8;
const FULL_TEAMS_LIMIT = 256;

export default function EventPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const arenaParam = searchParams.get("arena") ?? "";
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
  const { share, busy: shareBusy, message: shareMessage } = useShare();

  // Navigation filter state
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [filterSeason, setFilterSeason] = useState("");
  const [filterSplit, setFilterSplit] = useState("");
  const [phaseOptions, setPhaseOptions] = useState<string[]>([]);
  const [dayOptions, setDayOptions] = useState<string[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<string>("all");

  // Pick a stat state
  const [statCategories, setStatCategories] = useState<StatCategory[]>([]);
  const [selectedStats, setSelectedStats] = useState<string[]>(DEFAULT_STATS);

  // Load event data
  useEffect(() => {
    if (!eventId) return;
    setLeaderboardMode("avg");
    setSelectedPhase("all");
    setSelectedDay("all");
    const targetEventId = decodeURIComponent(eventId);

    async function loadEvent() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.eventDetail(targetEventId, {
          teamsLimit: FULL_TEAMS_LIMIT,
          arena: arenaParam || undefined,
        });
        setTeams(response.teams);
        setEvent(response.event);
        setBracket(response.bracket);
        setPhaseOptions(response.phases ?? []);
        setDayOptions(response.days ?? []);
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
  }, [eventId, eventRetryKey, arenaParam]);

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
          phase: selectedPhase !== "all" ? selectedPhase : undefined,
          day: selectedDay !== "all" ? selectedDay : undefined,
          arena: arenaParam || undefined,
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
  }, [event, leaderboardMode, selectedDay, selectedPhase, arenaParam]);

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

  const arenas = meta?.arenas ?? [];
  const effectiveArena = arenaParam && arenas.includes(arenaParam) ? arenaParam : "";

  // Silently drop invalid arena from the URL once meta is loaded.
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

  const updateArena = (next: string) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next) params.set("arena", next);
      else params.delete("arena");
      return params;
    });
  };

  const toggleStat = (key: string) => {
    setSelectedStats((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectedExtraStats = selectedStats.filter((k) => !CORE_LEADERBOARD_KEYS.has(k));
  const {
    dataByKey: leaderboardMap,
    loadingByKey: loadingStats,
    errorByKey: statLoadErrors,
  } = useStatLeaderboards(
    event ? selectedExtraStats : [],
    {
      type: "player",
      mode: leaderboardMode,
      sort: "desc",
      limit: 10,
      ssaOnly: true,
      gameMode: event?.mode ?? undefined,
      scope: event?.scope ?? undefined,
      tier: event?.tier ?? undefined,
      season: event?.season ?? undefined,
      split: event?.split ?? undefined,
      event: event?.name ?? undefined,
      arena: arenaParam || undefined,
      phase: selectedPhase,
      day: selectedDay,
    }
  );

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareTitle = event?.name ? `RLCS Stats · ${event.name}` : "RLCS Stats";
    const shareText = [event?.season, event?.split, event?.name].filter(Boolean).join(" / ");
    await share({ title: shareTitle, text: shareText, url: shareUrl });
  };

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

  const coreLeaderboardMap = new Map(leaderboards.map((lb) => [lb.metric.key, lb]));
  const coreLeaderboards = CORE_LEADERBOARDS.reduce<Array<{ title: string; data: LeaderboardResponse }>>((acc, item) => {
    const data = coreLeaderboardMap.get(item.key);
    if (data) {
      acc.push({ title: item.title, data });
    }
    return acc;
  }, []);

  return (
    <div className="page page-no-nav">
      <PageBackActions />

      {/* Search bar + navigation filters */}
      <div className="event-top-bar">
        <EventSearchWidget />

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
                const selectedName = e.target.value;
                if (selectedName) {
                  void api.search({
                    q: selectedName,
                    season: filterSeason || undefined,
                    split: filterSplit || undefined,
                    gameMode: event.mode || undefined,
                    scope: event.scope || undefined,
                    tier: event.tier || undefined,
                    limit: 20
                  }).then((response) => {
                    const match = (response.events ?? []).find((item) => item.label === selectedName);
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
      <div className="event-heading-row">
        <div>
          <h1 className="page-heading" style={{ marginBottom: 6 }}>{event.name}</h1>
          <div className="page-heading-sub">
            {[event.season, event.split].filter(Boolean).join(" / ")}
            {dateRange && <> &middot; {dateRange}</>}
          </div>
        </div>
        <div className="event-heading-actions">
          <button type="button" className="event-share-button" onClick={() => { void handleShare(); }} disabled={shareBusy}>
            {shareBusy ? "Sharing..." : "Share"}
          </button>
          {shareMessage ? <span className="event-share-message">{shareMessage}</span> : null}
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
          <EventBracketPanel
            event={event}
            teams={teams}
            bracket={bracket}
            showAllPlacements={showAllPlacements}
            onToggleShowAllPlacements={() => setShowAllPlacements((prev) => !prev)}
            topTeamsLimit={TOP_TEAMS_LIMIT}
          />

          <EventLeaderboardsPanel
            leaderboardMode={leaderboardMode}
            onLeaderboardModeChange={setLeaderboardMode}
            phaseOptions={phaseOptions}
            selectedPhase={selectedPhase}
            onSelectedPhaseChange={setSelectedPhase}
            dayOptions={dayOptions}
            selectedDay={selectedDay}
            onSelectedDayChange={setSelectedDay}
            arenas={arenas}
            effectiveArena={effectiveArena}
            onArenaChange={updateArena}
            coreLeaderboardItems={CORE_LEADERBOARDS.map((item) => ({ key: item.key, title: item.title }))}
            coreLeaderboards={coreLeaderboards}
            leaderboardsLoading={leaderboardsLoading}
            statCategories={statCategories}
            selectedStats={selectedStats}
            onToggleStat={toggleStat}
            visibleStatOptions={visibleStatOptions}
            selectedExtraStats={selectedExtraStats}
            leaderboardMap={leaderboardMap}
            loadingStats={loadingStats}
            statLoadErrors={statLoadErrors}
            allCategoryStats={allCategoryStats}
          />
        </>
      )}
    </div>
  );
}
