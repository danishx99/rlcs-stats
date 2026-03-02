import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { RosterEventResultRow, RosterProfile } from "../types/api";
import { proxyImageUrl, normalizeSocialLink, DEFAULT_TEAM_LOGO } from "../utils/normalize";
import { formatRosterStarters } from "../utils/roster";
import { resolveTeamRosterId } from "../utils/team-routing";
import { buildEventPath } from "../utils/event-routing";
import TeamNameWithLogo from "../components/TeamNameWithLogo";
import SocialIconLink from "../components/SocialIconLink";
import PanelState from "../components/ui/PanelState";
import SkeletonBlock from "../components/ui/SkeletonBlock";

const ROSTER_MODE = "3s" as const;

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

function formatPlacement(placement: string | null) {
  if (!placement) return "—";
  const match = placement.match(/^Top\s+(\d+)(?:-(\d+))?$/i);
  if (!match) return placement;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(end) || end <= 0) return placement;
  if (start === end) return ordinal(start);
  return `${ordinal(start)}-${ordinal(end)}`;
}

function rosterEventLabel(split: string | null, event: string | null) {
  if (split && event) return `${split} / ${event}`;
  return split ?? event ?? "Unknown Event";
}

export default function RosterPage() {
  const normalizeTeamName = (value: string | null | undefined) => value?.trim().toUpperCase() ?? "";
  const uniqueTeamNames = (names: string[], excludedNames: Array<string | null | undefined>) => {
    const excluded = new Set(excludedNames.map((name) => normalizeTeamName(name)).filter(Boolean));
    const seen = new Set<string>();
    const output: string[] = [];

    for (const name of names) {
      const key = normalizeTeamName(name);
      if (!key || excluded.has(key) || seen.has(key)) continue;
      seen.add(key);
      output.push(name);
    }

    return output;
  };

  const { rosterId } = useParams();
  const navigate = useNavigate();
  const [rosterProfile, setRosterProfile] = useState<RosterProfile | null>(null);
  const [rosterProfileLoading, setRosterProfileLoading] = useState(false);
  const [rosterProfileError, setRosterProfileError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [resultRows, setResultRows] = useState<RosterEventResultRow[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [resultsRefreshKey, setResultsRefreshKey] = useState(0);

  useEffect(() => {
    if (!rosterId) return;
    const rosterKey: string = rosterId;

    async function loadRoster() {
      setRosterProfileLoading(true);
      setRosterProfileError(null);
      try {
        const response = await api.rosterProfile(rosterKey, {
          gameMode: ROSTER_MODE
        });
        setRosterProfile(response.roster);

        const initialSeason = response.roster.defaultSeason
          ?? response.roster.seasonsCompeted?.[0]
          ?? response.roster.seasonRosters?.[0]?.season
          ?? "";
        setSelectedSeason(initialSeason);
      } catch (error) {
        console.error(error);
        setRosterProfile(null);
        setRosterProfileError("Failed to load team profile.");
      } finally {
        setRosterProfileLoading(false);
      }
    }

    loadRoster();
  }, [rosterId]);

  useEffect(() => {
    if (!rosterId || !selectedSeason) {
      setResultRows([]);
      return;
    }
    const rosterKey = rosterId;

    let isActive = true;
    async function loadResults() {
      setResultsLoading(true);
      setResultsError(null);
      try {
        const response = await api.rosterResults(rosterKey, {
          season: selectedSeason,
          gameMode: ROSTER_MODE
        });
        if (!isActive) return;
        setResultRows(response.rows ?? []);
      } catch (error) {
        if (!isActive) return;
        console.error(error);
        setResultRows([]);
        setResultsError("Failed to load team results.");
      } finally {
        if (!isActive) return;
        setResultsLoading(false);
      }
    }

    loadResults();
    return () => {
      isActive = false;
    };
  }, [resultsRefreshKey, rosterId, selectedSeason]);

  const seasonOptions = useMemo(() => {
    if (!rosterProfile) return [] as string[];

    if (rosterProfile.seasonsCompeted?.length) {
      return rosterProfile.seasonsCompeted;
    }

    return (rosterProfile.seasonRosters ?? []).map((entry) => entry.season);
  }, [rosterProfile]);

  const selectedSeasonEntry = useMemo(() => {
    if (!rosterProfile?.seasonRosters?.length) return null;
    return rosterProfile.seasonRosters.find((entry) => entry.season === selectedSeason) ?? null;
  }, [rosterProfile, selectedSeason]);

  if (rosterProfileLoading) {
    return (
      <div className="page page-no-nav roster-page" aria-busy="true">
        <button className="ghost back-button" onClick={() => navigate("/")}>
          ← Back to Dashboard
        </button>
        <h1 className="page-heading">Team Profile</h1>
        <div className="roster-top-grid">
          <div className="panel roster-profile-card roster-profile-card--compact">
            <div className="profile-header">
              <SkeletonBlock width={96} height={96} rounded="pill" />
              <div style={{ width: "100%", display: "grid", gap: 10 }}>
                <SkeletonBlock height={20} width="45%" />
                <SkeletonBlock height={13} width="66%" />
                <SkeletonBlock height={13} width="72%" />
                <SkeletonBlock height={13} width="54%" />
              </div>
            </div>
          </div>
          <div className="panel roster-rosters-panel">
            <SkeletonBlock height={22} width="40%" />
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonBlock key={`roster-skeleton-${index}`} height={26} width="100%" />
              ))}
            </div>
          </div>
        </div>

        <div className="panel roster-results-panel">
          <div className="panel-header inline">
            <SkeletonBlock height={20} width={80} />
            <SkeletonBlock height={26} width={100} rounded="pill" />
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
        </div>
      </div>
    );
  }

  if (!rosterProfile) {
    return (
      <div className="page page-no-nav">
        <button className="ghost back-button" onClick={() => navigate("/")}>
          ← Back to Dashboard
        </button>
        <div className="empty-state">{rosterProfileError ?? "Team not found."}</div>
      </div>
    );
  }

  const currentRoster = rosterProfile.currentRoster ?? rosterProfile.starters ?? [];
  const currentRosterLabel = formatRosterStarters(currentRoster);
  const twitterLink = normalizeSocialLink(rosterProfile.twitter, "twitter");
  const tiktokLink = normalizeSocialLink(rosterProfile.tiktok, "tiktok");
  const youtubeLink = normalizeSocialLink(rosterProfile.youtube, "youtube");
  const twitchLink = normalizeSocialLink(rosterProfile.twitch, "twitch");
  const navigateToTeam = async (teamName: string) => {
    const nextRosterId = await resolveTeamRosterId(teamName);
    navigate(`/rosters/${encodeURIComponent(nextRosterId)}`);
  };

  const iterations = selectedSeasonEntry?.iterations ?? [];
  const multipleIterations = iterations.length > 1;

  return (
    <div className="page page-no-nav roster-page">
      <button className="ghost back-button" onClick={() => navigate("/")}>
        ← Back to Dashboard
      </button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <h1 className="page-heading" style={{ margin: 0 }}>Team Profile</h1>
        {seasonOptions.length > 0 && (
          <div className="profile-filter-row">
            <select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)}>
              {seasonOptions.map((season) => (
                <option key={season} value={season}>{season}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="roster-top-grid">
        <div className="panel roster-profile-card roster-profile-card--compact">
          <div className="profile-header">
            <div className="roster-profile-media-column">
              <div className="profile-media">
                <img
                  src={proxyImageUrl(rosterProfile.logoUrl) ?? proxyImageUrl(DEFAULT_TEAM_LOGO)!}
                  alt={rosterProfile.name ?? "Team"}
                  loading="lazy"
                />
              </div>
              <div className="profile-links roster-profile-links">
                {twitterLink ? (
                  <SocialIconLink href={twitterLink} platform="twitter" />
                ) : null}
                {youtubeLink ? (
                  <SocialIconLink href={youtubeLink} platform="youtube" />
                ) : null}
                {twitchLink ? (
                  <SocialIconLink href={twitchLink} platform="twitch" />
                ) : null}
                {tiktokLink ? (
                  <SocialIconLink href={tiktokLink} platform="tiktok" />
                ) : null}
              </div>
            </div>
            <div className="profile-info">
              <h1>{rosterProfile.name ?? "Team"}</h1>
              <div className="profile-subtitle">{currentRosterLabel}</div>
              <dl className="roster-profile-facts">
                <div className="roster-profile-fact">
                  <dt>RLCS Debut</dt>
                  <dd>{rosterProfile.debut ?? "—"}</dd>
                </div>
                <div className="roster-profile-fact">
                  <dt>Best Result</dt>
                  <dd>{rosterProfile.bestResult ?? "—"}</dd>
                </div>
                <div className="roster-profile-fact">
                  <dt>Series</dt>
                  <dd>{rosterProfile.seriesPlayed}</dd>
                </div>
                <div className="roster-profile-fact">
                  <dt>Games</dt>
                  <dd>{rosterProfile.games}</dd>
                </div>
              </dl>
            </div>
          </div>

          {uniqueTeamNames(rosterProfile.otherTeamNames ?? [], [rosterProfile.name]).length > 0 && (
            <div className="profile-teams roster-profile-aliases">
              <div className="section-title">Also Competed Under</div>
              <div className="tag-list">
                {uniqueTeamNames(rosterProfile.otherTeamNames ?? [], [rosterProfile.name]).map((teamName) => (
                  <button
                    key={teamName}
                    type="button"
                    className="tag tag-button"
                    onClick={() => {
                      void navigateToTeam(teamName);
                    }}
                    title={`View ${teamName} team page`}
                  >
                    <TeamNameWithLogo team={teamName} link={false} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="panel roster-rosters-panel">
          <div className="panel-header inline">
            <h3>Rosters</h3>
            {selectedSeason && <span className="panel-tag">{selectedSeason}</span>}
          </div>

          {iterations.length === 0 ? (
            <p className="empty">No roster data for this season.</p>
          ) : !multipleIterations ? (
            <div className="roster-compact-card">
              <div className="roster-iteration-header">
                <h3>{iterations[0]?.teamLabelUsed ?? rosterProfile.name ?? "Team"}</h3>
                <span>{iterations[0]?.seriesPlayed ?? 0} series</span>
              </div>
              <div className="roster-iteration-block">
                <div className="section-title">Starters</div>
                <div className="tag-list">
                  {(iterations[0]?.starters ?? []).map((starter) => (
                    <button
                      key={starter.id}
                      type="button"
                      className="tag tag-button tag-current"
                      onClick={() => navigate(`/players/${starter.id}`)}
                    >
                      {starter.handle ?? starter.id}
                    </button>
                  ))}
                </div>
              </div>
              {(iterations[0]?.alternates?.length ?? 0) > 0 && (
                <div className="roster-iteration-block">
                  <div className="section-title">Alternates</div>
                  <div className="tag-list">
                    {(iterations[0]?.alternates ?? []).map((alt) => (
                      <button
                        key={alt.id}
                        type="button"
                        className="tag tag-button"
                        onClick={() => navigate(`/players/${alt.id}`)}
                      >
                        {alt.handle ?? alt.id}
                        {alt.appearances != null ? ` (${alt.appearances})` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="roster-iterations-grid roster-iterations-grid--stacked">
              {iterations.map((iteration) => {
                const iterationDisplayName = iteration.teamLabelUsed ?? rosterProfile.name ?? "Team";
                const iterationOtherNames = uniqueTeamNames(
                  iteration.alsoCompetedUnder ?? [],
                  [iteration.teamLabelUsed, rosterProfile.name]
                );

                return (
                  <div key={`${selectedSeasonEntry?.season}-${iteration.rosterId}`} className="roster-iteration-card panel">
                    <div className="roster-iteration-header">
                      <h3>{iterationDisplayName}</h3>
                      <span>{iteration.seriesPlayed} series</span>
                    </div>

                    <div className="roster-iteration-block">
                      <div className="section-title">Starters</div>
                      <div className="tag-list">
                        {iteration.starters.map((starter) => (
                          <button
                            key={starter.id}
                            type="button"
                            className="tag tag-button tag-current"
                            onClick={() => navigate(`/players/${starter.id}`)}
                          >
                            {starter.handle ?? starter.id}
                          </button>
                        ))}
                      </div>
                    </div>

                    {iteration.events && iteration.events.length > 0 && (
                      <div className="roster-iteration-block">
                        <div className="section-title">Active Across</div>
                        <div className="tag-list">
                          {iteration.events.map((ev, idx) => (
                            <span key={`${iteration.rosterId}-${idx}`} className="tag">
                              {rosterEventLabel(ev.split, ev.event)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {iterationOtherNames.length > 0 && (
                      <div className="roster-iteration-block">
                        <div className="section-title">Also Competed Under</div>
                        <div className="tag-list">
                          {iterationOtherNames.map((teamName) => (
                            <button
                              key={teamName}
                              type="button"
                              className="tag tag-button"
                              onClick={() => {
                                void navigateToTeam(teamName);
                              }}
                            >
                              <TeamNameWithLogo team={teamName} link={false} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="panel roster-results-panel">
        <div className="panel-header inline">
          <h3>Results</h3>
          {selectedSeason && <span className="panel-tag">{selectedSeason}</span>}
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
        ) : resultRows.length === 0 ? (
          <PanelState state="empty" message="No event results found for this season." />
        ) : (
          <div className="results-table-wrap">
            <table className="results-table roster-results-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Placement</th>
                  <th>Opponent</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.map((row, index) => {
                  const isRegional = row.scope === "regional";
                  const canNavigateToEvent = isRegional && Boolean(row.eventId);
                  const eventLabel = [row.split, row.event].filter(Boolean).join(" / ");
                  const placement = isRegional ? formatPlacement(row.placement) : "—";
                  const isChampion = isRegional && placement === "1st";
                  return (
                    <tr
                      key={`${row.eventId ?? row.event ?? "event"}-${row.rosterId ?? "none"}-${index}`}
                      className={row.wonSeries ? "results-row--win" : "results-row--loss"}
                    >
                      <td>
                        {canNavigateToEvent ? (
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => navigate(buildEventPath(row.eventId!))}
                          >
                            {eventLabel || row.event || "—"}
                          </button>
                        ) : (
                          <span>{eventLabel || row.event || "—"}</span>
                        )}
                      </td>
                      <td>
                        <span className={`results-placement${isChampion ? " results-placement--gold" : ""}`}>
                          {placement}
                        </span>
                      </td>
                      <td className="results-cell-opponent">
                        {row.opponent ? <TeamNameWithLogo team={row.opponent} link={isRegional} /> : "—"}
                      </td>
                      <td className="results-cell-score">
                        {row.opponent ? (
                          <>
                            <span className={row.wonSeries ? "score-win" : "score-loss"}>{row.playerWins}</span>
                            <span className="score-dash"> - </span>
                            <span className={row.wonSeries ? "score-loss" : "score-win"}>{row.opponentWins}</span>
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
      </div>
    </div>
  );
}
