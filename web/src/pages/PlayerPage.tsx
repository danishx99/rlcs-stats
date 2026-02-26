import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { MetaResponse, PlayerProfile, PlayerResultEvent, SeasonResponse, SeasonRow } from "../types/api";
import SeasonTable from "../components/SeasonTable";
import TeamNameWithLogo from "../components/TeamNameWithLogo";
import { computeAge, formatDate } from "../utils/date";
import { buildEventPath, parseDebutEvent } from "../utils/event-routing";
import { normalizeSocialLink, proxyImageUrl, DEFAULT_PLAYER_PHOTO } from "../utils/normalize";
import { resolveTeamRosterId } from "../utils/team-routing";

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

export default function PlayerPage({
  filters,
  meta: _meta,
  onFiltersChange: _onFiltersChange
}: {
  filters: { season: string; split: string; event: string };
  meta: MetaResponse | null;
  onFiltersChange: (f: { season: string; split: string; event: string }) => void;
}) {
  const { uniqueId } = useParams();
  const navigate = useNavigate();
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [playerProfileLoading, setPlayerProfileLoading] = useState(false);
  const [playerProfileError, setPlayerProfileError] = useState<string | null>(null);
  const [seasonRows, setSeasonRows] = useState<SeasonRow[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [results, setResults] = useState<PlayerResultEvent[]>([]);
  const [resultSeasons, setResultSeasons] = useState<string[]>([]);
  const [resultSeason, setResultSeason] = useState("");
  const [resultsViewMode, setResultsViewMode] = useState<"season" | "all">("season");
  const [resultSeasonsLoading, setResultSeasonsLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);

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
    if (!uniqueId) return;
    const playerId = uniqueId;
    async function loadSeason() {
      setSeasonLoading(true);
      try {
        const response: SeasonResponse = await api.playerSeason(playerId, {
          mode: "avg"
        });
        setSeasonRows(response.rows);
      } catch (error) {
        console.error(error);
      } finally {
        setSeasonLoading(false);
      }
    }

    loadSeason();
  }, [uniqueId]);

  useEffect(() => {
    if (!uniqueId) return;
    const playerId = uniqueId;
    let isActive = true;
    async function loadResultSeasons() {
      setResultSeasonsLoading(true);
      try {
        const response: SeasonResponse = await api.playerSeason(playerId, {
          mode: "avg"
        });
        if (!isActive) return;
        const seasons = response.rows
          .map((row) => row.season)
          .filter((season): season is string => Boolean(season))
          .reverse();
        setResultSeasons(seasons);
        setResultSeason((current) => {
          if (current && seasons.includes(current)) return current;
          return seasons[0] ?? "";
        });
      } catch (error) {
        if (!isActive) return;
        console.error(error);
        setResultSeasons([]);
        setResultSeason("");
      } finally {
        if (!isActive) return;
        setResultSeasonsLoading(false);
      }
    }

    loadResultSeasons();

    return () => {
      isActive = false;
    };
  }, [uniqueId]);

  useEffect(() => {
    if (!uniqueId || (resultsViewMode === "season" && !resultSeason)) {
      setResults([]);
      if (!resultSeasonsLoading) {
        setResultsLoading(false);
      }
      return;
    }
    const playerId = uniqueId;
    let isActive = true;
    async function loadResultsForSeason() {
      setResultsLoading(true);
      try {
        const response = await api.playerResults(
          playerId,
          resultsViewMode === "season"
            ? { season: resultSeason }
            : undefined
        );
        if (!isActive) return;
        setResults(response.events);
      } catch (error) {
        if (!isActive) return;
        console.error(error);
        setResults([]);
      } finally {
        if (!isActive) return;
        setResultsLoading(false);
      }
    }

    loadResultsForSeason();

    return () => {
      isActive = false;
    };
  }, [uniqueId, resultSeason, resultSeasonsLoading, resultsViewMode]);

  const showResultsLoading = resultSeasonsLoading || resultsLoading;

  if (playerProfileLoading) {
    return <div className="page page-no-nav">Loading player profile...</div>;
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
  const debutEvent = parseDebutEvent(playerProfile.debut);
  const currentTeam = playerProfile.teams[0] ?? null;
  const navigateToTeam = async (teamName: string) => {
    const rosterId = await resolveTeamRosterId(teamName);
    navigate(`/rosters/${encodeURIComponent(rosterId)}`);
  };

  return (
    <div className="page page-no-nav player-page">
      <button className="ghost back-button" onClick={() => navigate("/")}>
        ← Back to Dashboard
      </button>

      <h1 className="player-page-title">Player Profile</h1>

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
              <p>{playerProfile.playerName ?? "—"}</p>
            </div>
          </div>
          <div className="player-overview-list">
            <div><span>Name</span><strong>{playerProfile.realName ?? "—"}</strong></div>
            <div><span>Country</span><strong>{playerProfile.country ?? "—"}</strong></div>
            <div>
              <span>Current Team</span>
              <strong>
                {currentTeam ? <TeamNameWithLogo team={currentTeam} /> : "—"}
              </strong>
            </div>
            <div>
              <span>Birthday</span>
              <strong>{playerProfile.dateOfBirth ? formatDate(playerProfile.dateOfBirth) : "—"}{age ? ` (Age ${age})` : ""}</strong>
            </div>
            <div>
              <span>Debut</span>
              <strong>
                {playerProfile.debut && debutEvent ? (
                  <Link
                    className="inline-link"
                    to={buildEventPath(debutEvent.event, { season: debutEvent.season, split: debutEvent.split })}
                  >
                    {playerProfile.debut}
                  </Link>
                ) : (
                  playerProfile.debut ?? "—"
                )}
              </strong>
            </div>
            <div><span>Best Result</span><strong>{playerProfile.bestResult ?? "—"}</strong></div>
          </div>
          <div className="profile-links">
            {twitchLink ? (
              <a href={twitchLink} target="_blank" rel="noreferrer">
                Twitch
              </a>
            ) : null}
            {tiktokLink ? (
              <a href={tiktokLink} target="_blank" rel="noreferrer">
                TikTok
              </a>
            ) : null}
          </div>
        </section>

        <section className="panel player-season-card">
          <div className="section-header player-season-header">
            <h2>Perf by Season</h2>
          </div>
          {seasonLoading ? <div className="loading">Loading seasons...</div> : null}
          <SeasonTable rows={[...seasonRows].reverse()} />
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

        {showResultsLoading ? (
          <div className="loading">Loading event results...</div>
        ) : results.length === 0 ? (
          <div className="empty-state">
            {resultsViewMode === "season" ? "No event results found for this season." : "No event results found."}
          </div>
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
                  const eventLabel = [event.split, event.event].filter(Boolean).join(" / ");
                  const eventHref = event.event
                    ? buildEventPath(event.event, { season: event.season, split: event.split })
                    : null;
                  const placement = formatPlacement(
                    event.placement,
                    event.placementStart,
                    event.placementEnd
                  );
                  const isChampion =
                    (event.placementStart === 1 && event.placementEnd === 1) || placement === "1st";
                  return (
                    <tr
                      key={`${event.season}-${event.split}-${event.event}`}
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
                        {s?.opponent ? <TeamNameWithLogo team={s.opponent} /> : "—"}
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
      </div>
    </div>
  );
}
