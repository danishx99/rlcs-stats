import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { PlayerProfile, PlayerResultEvent, SeasonResponse, SeasonRow } from "../types/api";
import SeasonTable from "../components/SeasonTable";
import SocialIconLink from "../components/SocialIconLink";
import TeamNameWithLogo from "../components/TeamNameWithLogo";
import { formatAliases } from "../utils/aliases";
import { computeAge, formatDate } from "../utils/date";
import { buildEventPath } from "../utils/event-routing";
import { normalizeSocialLink, proxyImageUrl, DEFAULT_PLAYER_PHOTO } from "../utils/normalize";
import { resolveTeamRosterId } from "../utils/team-routing";
import PanelState from "../components/ui/PanelState";
import SkeletonBlock from "../components/ui/SkeletonBlock";

function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function formatPlacement(
  placement: string | null,
  placementStart: number | null | undefined,
  placementEnd: number | null | undefined
) {
  const hasRange =
    Number.isFinite(placementStart) &&
    Number.isFinite(placementEnd) &&
    Number(placementStart) > 0 &&
    Number(placementEnd) > 0;
  if (hasRange) {
    const start = Number(placementStart);
    const end = Number(placementEnd);
    if (start === end) {
      return ordinal(start);
    }
    return `${ordinal(start)}-${ordinal(end)}`;
  }

  if (!placement) return "—";
  const match = placement.match(/^Top\s+(\d+)$/i);
  if (!match) return placement;
  const top = Number(match[1]);
  if (!Number.isFinite(top) || top <= 0) return placement;
  if (top === 1) return "1st";
  if (top === 2) return "2nd";
  const start = Math.floor(top / 2) + 1;
  return `${ordinal(start)}-${ordinal(top)}`;
}

export default function PlayerPage() {
  const { uniqueId } = useParams();
  const navigate = useNavigate();
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [playerProfileLoading, setPlayerProfileLoading] = useState(false);
  const [playerProfileError, setPlayerProfileError] = useState<string | null>(null);
  const [seasonRows, setSeasonRows] = useState<SeasonRow[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [seasonRefreshKey, setSeasonRefreshKey] = useState(0);
  const [seasonGameMode, setSeasonGameMode] = useState<"1s" | "2s" | "3s">("3s");
  const [seasonIncludeLans, setSeasonIncludeLans] = useState(false);
  const [results, setResults] = useState<PlayerResultEvent[]>([]);
  const [resultSeasons, setResultSeasons] = useState<string[]>([]);
  const [resultSeason, setResultSeason] = useState("");
  const [resultsViewMode, setResultsViewMode] = useState<"season" | "all">("season");
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [resultsRefreshKey, setResultsRefreshKey] = useState(0);
  const [hasLanEvents, setHasLanEvents] = useState(false);
  const allTimeCacheRef = useRef<{ playerId: string; events: PlayerResultEvent[]; seasons: string[] } | null>(null);
  const allTimePrefetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!uniqueId) return;
    const playerId = uniqueId;
    async function loadProfile() {
      setPlayerProfileLoading(true);
      setPlayerProfileError(null);
      try {
        const response = await api.playerProfile(playerId);
        setPlayerProfile(response.player);
      } catch (error) {
        console.error(error);
        setPlayerProfile(null);
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (message.includes("player not found") || message.includes("api error 404")) {
          setPlayerProfileError("Player profile not found.");
        } else {
          setPlayerProfileError("Failed to load player profile");
        }
      } finally {
        setPlayerProfileLoading(false);
      }
    }

    loadProfile();
  }, [uniqueId]);

  useEffect(() => {
    setSeasonIncludeLans(false);
  }, [uniqueId]);

  useEffect(() => {
    if (!uniqueId) return;
    const playerId = uniqueId;
    async function loadSeason() {
      setSeasonLoading(true);
      setSeasonError(null);
      try {
        const response: SeasonResponse = await api.playerSeason(playerId, {
          mode: "avg",
          gameMode: seasonGameMode,
          scope: seasonGameMode === "3s" && !seasonIncludeLans ? "regional" : undefined,
          tier: seasonGameMode === "3s" && !seasonIncludeLans ? "none" : undefined
        });
        setSeasonRows(response.rows);
      } catch (error) {
        console.error(error);
        setSeasonRows([]);
        setSeasonError("Failed to load seasonal performance.");
      } finally {
        setSeasonLoading(false);
      }
    }

    loadSeason();
  }, [seasonGameMode, seasonIncludeLans, seasonRefreshKey, uniqueId]);

  useEffect(() => {
    if (resultSeason || !seasonRows.length) return;
    const latest = seasonRows[seasonRows.length - 1]?.season ?? "";
    if (latest) setResultSeason(latest);
  }, [resultSeason, seasonRows]);

  useEffect(() => {
    allTimeCacheRef.current = null;
    allTimePrefetchedRef.current = null;
    setHasLanEvents(false);
  }, [uniqueId]);

  useEffect(() => {
    if (!uniqueId) {
      setResults([]);
      setResultSeasons([]);
      setResultSeason("");
      setResultsLoading(false);
      return;
    }
    if (resultsViewMode === "all" && allTimeCacheRef.current?.playerId === uniqueId) {
      setResults(allTimeCacheRef.current.events);
      setResultSeasons(allTimeCacheRef.current.seasons);
      setResultsLoading(false);
      setResultsError(null);
      return;
    }
    const playerId = uniqueId;
    const params: Record<string, string> = {};
    if (resultsViewMode === "season" && resultSeason) {
      params.season = resultSeason;
    }
    let isActive = true;
    async function loadResults() {
      setResultsLoading(true);
      setResultsError(null);
      try {
        const response = await api.playerResults(playerId, params);
        if (!isActive) return;
        setResults(response.events);
        const seasons = (response.seasons ?? []).filter(Boolean).reverse();
        setResultSeasons(seasons);
        setResultSeason((current) => {
          if (current && seasons.includes(current)) return current;
          return seasons[0] ?? "";
        });
        if (response.events.some((e) => e.scope === "international")) {
          setHasLanEvents(true);
        }
        if (resultsViewMode === "all") {
          allTimeCacheRef.current = { playerId, events: response.events, seasons };
        }
      } catch (error) {
        if (!isActive) return;
        console.error(error);
        setResults([]);
        setResultsError("Failed to load event results.");
      } finally {
        if (!isActive) return;
        setResultsLoading(false);
      }
    }

    loadResults();

    return () => {
      isActive = false;
    };
  }, [resultsRefreshKey, resultSeason, resultsViewMode, uniqueId]);

  useEffect(() => {
    if (!uniqueId || allTimePrefetchedRef.current === uniqueId) return;
    if (!resultSeason) return;
    allTimePrefetchedRef.current = uniqueId;
    const playerId = uniqueId;
    api.playerResults(playerId).then((response) => {
      if (allTimePrefetchedRef.current !== playerId) return;
      const seasons = (response.seasons ?? []).filter(Boolean).reverse();
      allTimeCacheRef.current = { playerId, events: response.events, seasons };
      if (response.events.some((e) => e.scope === "international")) {
        setHasLanEvents(true);
      }
    }).catch(() => {
      allTimePrefetchedRef.current = null;
    });
  }, [uniqueId, resultSeason]);

  const playerHasLanEvents = hasLanEvents;

  if (playerProfileLoading) {
    return (
      <div className="page page-no-nav player-page" aria-busy="true">
        <button className="ghost back-button" onClick={() => navigate("/")}>
          ← Back to Dashboard
        </button>
        <h1 className="page-heading">Player Profile</h1>
        <div className="player-top-grid">
          <section className="panel player-overview-card">
            <div className="player-overview-head">
              <SkeletonBlock width={98} height={98} rounded="pill" />
              <div style={{ width: "100%", display: "grid", gap: 10 }}>
                <SkeletonBlock height={20} width="52%" />
                <SkeletonBlock height={14} width="70%" />
                <SkeletonBlock height={14} width="46%" />
              </div>
            </div>
            <div className="player-overview-list">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`profile-skeleton-${index}`}>
                  <SkeletonBlock height={11} width={60} />
                  <SkeletonBlock height={13} width="55%" />
                </div>
              ))}
            </div>
          </section>
          <section className="panel player-season-card">
            <SkeletonBlock height={20} width={180} />
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonBlock key={`season-skeleton-${index}`} height={26} width="100%" />
              ))}
            </div>
          </section>
        </div>

        <section className="panel player-results-card">
          <div className="section-header">
            <SkeletonBlock height={20} width={90} />
            <SkeletonBlock height={30} width={160} rounded="pill" />
          </div>
          <div className="skel-table">
            <div className="skel-table-header skel-results-row">
              <SkeletonBlock height={12} width="40%" />
              <SkeletonBlock height={12} width="60%" />
              <SkeletonBlock height={12} width="50%" />
              <SkeletonBlock height={12} width="40%" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`results-init-skel-${i}`} className="skel-table-row skel-results-row">
                <SkeletonBlock height={14} width={`${70 - i * 6}%`} />
                <SkeletonBlock height={14} width="50%" />
                <SkeletonBlock height={14} width={`${60 - i * 5}%`} />
                <SkeletonBlock height={14} width="55%" />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (playerProfileError || !playerProfile) {
    return (
      <div className="page page-no-nav">
        <button className="ghost back-button" onClick={() => navigate("/")}>
          ← Back to Dashboard
        </button>
        <div className="empty-state">{playerProfileError || "Player not found."}</div>
      </div>
    );
  }

  const age = computeAge(playerProfile.dateOfBirth);
  const twitchLink = normalizeSocialLink(playerProfile.twitch, "twitch");
  const tiktokLink = normalizeSocialLink(playerProfile.tiktok, "tiktok");
  const currentTeam = playerProfile.teams[0] ?? null;
  const navigateToTeam = async (teamName: string) => {
    const rosterId = await resolveTeamRosterId(teamName);
    const cache = allTimeCacheRef.current;
    const allEvents = cache && cache.playerId === uniqueId ? cache.events : results;
    const teamNorm = teamName.trim().toUpperCase();
    const match = allEvents.find(
      (e) => e.team && e.team.trim().toUpperCase() === teamNorm
    );
    const params = match?.season ? `?season=${encodeURIComponent(match.season)}` : "";
    navigate(`/rosters/${encodeURIComponent(rosterId)}${params}`);
  };

  return (
    <div className="page page-no-nav player-page">
      <button className="ghost back-button" onClick={() => navigate("/")}>
        ← Back to Dashboard
      </button>

      <h1 className="page-heading">Player Profile</h1>

      <div className="player-top-grid">
        <section className="panel player-overview-card">
          <div className="player-overview-head">
            <div className="profile-media">
              <img
                src={proxyImageUrl(playerProfile.photoUrl) ?? proxyImageUrl(DEFAULT_PLAYER_PHOTO)!}
                alt={playerProfile.handle ?? playerProfile.playerName ?? "Player"}
                loading="lazy"
              />
            </div>
            <div className="player-overview-name">
              <h2>{playerProfile.handle ?? playerProfile.playerName ?? "Player"}</h2>
              <div className="player-overview-meta">
                <div className="player-overview-meta-row">
                  <span>Country</span>
                  <strong>{playerProfile.country ?? "—"}</strong>
                </div>
                <div className="player-overview-meta-row">
                  <span>Current Team</span>
                  <strong>{currentTeam ? <TeamNameWithLogo team={currentTeam} /> : "—"}</strong>
                </div>
              </div>
            </div>
          </div>
          <div className="player-overview-list">
            <div><span>Name</span><strong>{playerProfile.realName ?? "—"}</strong></div>
            <div><span>Aliases</span><strong>{formatAliases(playerProfile.aliases)}</strong></div>
            <div>
              <span>Birthday</span>
              <strong>{playerProfile.dateOfBirth ? formatDate(playerProfile.dateOfBirth) : "—"}{age ? ` (Age ${age})` : ""}</strong>
            </div>
            <div>
              <span>Debut</span>
              <strong>
                {playerProfile.debut ?? "—"}
              </strong>
            </div>
            <div><span>Best Result</span><strong>{playerProfile.bestResult ?? "—"}</strong></div>
          </div>
          <div className="profile-links">
            {twitchLink ? (
              <SocialIconLink href={twitchLink} platform="twitch" />
            ) : null}
            {tiktokLink ? (
              <SocialIconLink href={tiktokLink} platform="tiktok" />
            ) : null}
          </div>
        </section>

        <section className="panel player-season-card">
          <div className="section-header player-season-header">
            <h2>Perf by Season</h2>
            <div className="profile-filter-row">
              {playerHasLanEvents && (
                <label className="checkbox-inline">
                  <input
                    type="checkbox"
                    checked={seasonIncludeLans}
                    onChange={(e) => setSeasonIncludeLans(e.target.checked)}
                    disabled={seasonGameMode !== "3s"}
                  />
                  Include LAN Events
                </label>
              )}
              <select
                value={seasonGameMode}
                onChange={(e) => {
                  const mode = e.target.value as "1s" | "2s" | "3s";
                  setSeasonGameMode(mode);
                  if (mode !== "3s") {
                    setSeasonIncludeLans(false);
                  }
                }}
              >
                <option value="1s">1s</option>
                <option value="2s">2s</option>
                <option value="3s">3s</option>
              </select>
            </div>
          </div>
          {seasonLoading ? (
            <div className="skel-table" role="status" aria-busy="true">
              <div className="skel-table-row skel-season-row">
                <SkeletonBlock height={14} width="60%" />
                <SkeletonBlock height={14} />
                <SkeletonBlock height={14} />
                <SkeletonBlock height={14} />
                <SkeletonBlock height={14} />
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`season-skel-${i}`} className="skel-table-row skel-season-row">
                  <SkeletonBlock height={14} width="50%" />
                  <SkeletonBlock height={14} />
                  <SkeletonBlock height={14} />
                  <SkeletonBlock height={14} />
                  <SkeletonBlock height={14} />
                </div>
              ))}
            </div>
          ) : null}
          {seasonError ? (
            <PanelState
              state="error"
              message={seasonError}
              onRetry={() => setSeasonRefreshKey((value) => value + 1)}
            />
          ) : seasonRows.length === 0 && !seasonLoading ? (
            <PanelState state="empty" message="No season data available for this filter." />
          ) : (
            <SeasonTable rows={[...seasonRows].reverse()} />
          )}
        </section>
      </div>

      <section className="panel player-results-card">
        <div className="section-header">
          <h2>Results</h2>
          <div className="section-controls">
            <div className="toggle">
              <button
                type="button"
                className={resultsViewMode === "season" ? "active" : ""}
                onClick={() => setResultsViewMode("season")}
              >
                Season
              </button>
              <button
                type="button"
                className={resultsViewMode === "all" ? "active" : ""}
                onClick={() => setResultsViewMode("all")}
              >
                All-Time
              </button>
            </div>
            {resultsViewMode === "season" && resultSeasons.length > 0 && (
              <select
                className="results-season-select"
                value={resultSeason}
                onChange={(e) => setResultSeason(e.target.value)}
              >
                {resultSeasons.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {resultsLoading ? (
          <div className="skel-table" role="status" aria-busy="true">
            <div className="skel-table-header skel-results-row">
              <SkeletonBlock height={12} width="40%" />
              <SkeletonBlock height={12} width="60%" />
              <SkeletonBlock height={12} width="50%" />
              <SkeletonBlock height={12} width="40%" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`results-skel-${i}`} className="skel-table-row skel-results-row">
                <SkeletonBlock height={14} width={`${70 - i * 6}%`} />
                <SkeletonBlock height={14} width="50%" />
                <SkeletonBlock height={14} width={`${60 - i * 5}%`} />
                <SkeletonBlock height={14} width="55%" />
              </div>
            ))}
          </div>
        ) : resultsError ? (
          <PanelState
            state="error"
            message={resultsError}
            onRetry={() => setResultsRefreshKey((value) => value + 1)}
          />
        ) : results.length === 0 ? (
          <PanelState
            state="empty"
            message={resultsViewMode === "season" ? "No event results found for this season." : "No event results found."}
          />
        ) : (
          <div className="results-table-wrap">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Placement</th>
                  <th>Opponent</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {results.map((event) => {
                  const s = event.series[0];
                  const won = s?.wonSeries ?? false;
                  const isLanResult = event.scope === "international";
                  const eventLabel = [event.split, event.event].filter(Boolean).join(" / ");
                  const eventHref = event.eventId
                    ? buildEventPath(event.eventId)
                    : null;
                  const placement = isLanResult
                    ? "—"
                    : formatPlacement(
                        event.placement,
                        event.placementStart,
                        event.placementEnd
                      );
                  const isChampion =
                    !isLanResult && (
                      (event.placementStart === 1 && event.placementEnd === 1) || placement === "1st"
                    );
                  return (
                    <tr
                      key={
                        event.eventId ??
                        `${event.season}-${event.split}-${event.mode}-${event.scope}-${event.tier}-${event.event}`
                      }
                      className={won ? "results-row--win" : "results-row--loss"}
                    >
                      <td className="results-cell-event">
                        {eventHref ? (
                          <Link className="inline-link" to={eventHref}>
                            {eventLabel || event.event}
                          </Link>
                        ) : (
                          eventLabel || "—"
                        )}
                      </td>
                      <td>
                        <span className={`results-placement${isChampion ? " results-placement--gold" : ""}`}>
                          {placement}
                        </span>
                      </td>
                      <td className="results-cell-opponent">
                        {s?.opponent ? <TeamNameWithLogo team={s.opponent} link={!isLanResult} /> : "—"}
                      </td>
                      <td className="results-cell-score">
                        {s ? (
                          <>
                            <span className={won ? "score-win" : "score-loss"}>{s.playerWins}</span>
                            <span className="score-dash"> - </span>
                            <span className={won ? "score-loss" : "score-win"}>{s.opponentWins}</span>
                          </>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="profile-teams">
        <div className="section-title">Teams</div>
        {playerProfile.teams.length === 0 ? (
          <PanelState state="empty" message="No teams available for this player." />
        ) : (
          <div className="tag-list">
            {playerProfile.teams.map((team, i) => (
              <button
                key={`${team}-${i}`}
                type="button"
                className={`tag tag-button${i === 0 ? " tag-current" : ""}`}
                onClick={() => {
                  void navigateToTeam(team);
                }}
                title={`View ${team} team page`}
              >
                <TeamNameWithLogo team={team} link={false} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
