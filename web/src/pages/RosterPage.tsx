import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { MetaResponse, RosterProfile } from "../types/api";
import { buildEventPath, parseDebutEvent } from "../utils/event-routing";
import { proxyImageUrl, normalizeSocialLink } from "../utils/normalize";
import { formatRosterStarters } from "../utils/roster";
import { resolveTeamRosterId } from "../utils/team-routing";
import TeamNameWithLogo from "../components/TeamNameWithLogo";

export default function RosterPage({
  filters: _filters,
  meta: _meta,
  onFiltersChange: _onFiltersChange
}: {
  filters: { season: string; split: string; event: string };
  meta: MetaResponse | null;
  onFiltersChange: (f: { season: string; split: string; event: string }) => void;
}) {
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
  const [selectedSeason, setSelectedSeason] = useState<string>("");

  useEffect(() => {
    if (!rosterId) return;
    const rosterKey: string = rosterId;

    async function loadRoster() {
      setRosterProfileLoading(true);
      try {
        const response = await api.rosterProfile(rosterKey);
        setRosterProfile(response.roster);

        const initialSeason = response.roster.defaultSeason
          ?? response.roster.seasonsCompeted?.[0]
          ?? response.roster.seasonRosters?.[0]?.season
          ?? "";
        setSelectedSeason(initialSeason);
      } catch (error) {
        console.error(error);
      } finally {
        setRosterProfileLoading(false);
      }
    }

    loadRoster();
  }, [rosterId]);

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
    return <div className="page page-no-nav">Loading team profile...</div>;
  }

  if (!rosterProfile) {
    return (
      <div className="page page-no-nav">
        <button className="ghost back-button" onClick={() => navigate("/")}>
          ← Back to Dashboard
        </button>
        <div className="empty-state">Team not found.</div>
      </div>
    );
  }

  const currentRoster = rosterProfile.currentRoster ?? rosterProfile.starters ?? [];
  const currentRosterLabel = formatRosterStarters(currentRoster);
  const twitterLink = normalizeSocialLink(rosterProfile.twitter, "twitter");
  const tiktokLink = normalizeSocialLink(rosterProfile.tiktok, "tiktok");
  const youtubeLink = normalizeSocialLink(rosterProfile.youtube, "youtube");
  const twitchLink = normalizeSocialLink(rosterProfile.twitch, "twitch");
  const debutEvent = parseDebutEvent(rosterProfile.debut);
  const navigateToTeam = async (teamName: string) => {
    const rosterId = await resolveTeamRosterId(teamName);
    navigate(`/rosters/${encodeURIComponent(rosterId)}`);
  };

  return (
    <div className="page page-no-nav">
      <button className="ghost back-button" onClick={() => navigate("/")}>
        ← Back to Dashboard
      </button>

      <div className="panel roster-profile-card">
        <div className="profile-header">
          <div className="profile-media">
            {rosterProfile.logoUrl ? (
              <img
                src={proxyImageUrl(rosterProfile.logoUrl) ?? undefined}
                alt={rosterProfile.name ?? "Team"}
                loading="lazy"
              />
            ) : (
              <div className="profile-avatar roster-avatar">
                {rosterProfile.name?.[0] ?? "?"}
              </div>
            )}
          </div>
          <div className="profile-info">
            <h1>{rosterProfile.name ?? "Team"}</h1>
            <div className="profile-subtitle">{currentRosterLabel}</div>
            <div className="profile-meta">
              <div>
                <span>RLCS Debut</span>
                <strong>
                  {rosterProfile.debut && debutEvent ? (
                    <Link
                      className="inline-link"
                      to={buildEventPath(debutEvent.event, { season: debutEvent.season, split: debutEvent.split })}
                    >
                      {rosterProfile.debut}
                    </Link>
                  ) : (
                    rosterProfile.debut ?? "—"
                  )}
                </strong>
              </div>
              <div>
                <span>Best Result</span>
                <strong>{rosterProfile.bestResult ?? "—"}</strong>
              </div>
              <div>
                <span>Series</span>
                <strong>{rosterProfile.seriesPlayed}</strong>
              </div>
              <div>
                <span>Games</span>
                <strong>{rosterProfile.games}</strong>
              </div>
            </div>
            <div className="profile-links">
              {twitterLink ? (
                <a href={twitterLink} target="_blank" rel="noreferrer">
                  Twitter
                </a>
              ) : null}
              {youtubeLink ? (
                <a href={youtubeLink} target="_blank" rel="noreferrer">
                  YouTube
                </a>
              ) : null}
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
          </div>
        </div>
      </div>

      <div className="section-header">
        <h2>Roster Iterations by Season</h2>
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

      {!selectedSeasonEntry || selectedSeasonEntry.iterations.length === 0 ? (
        <div className="empty-state">No roster iterations found for this season.</div>
      ) : (
        <div className="roster-iterations-grid">
          {selectedSeasonEntry.iterations.map((iteration) => {
            const iterationDisplayName = iteration.teamLabelUsed ?? rosterProfile.name ?? "Team";
            const iterationOtherNames = uniqueTeamNames(
              iteration.alsoCompetedUnder ?? [],
              [iteration.teamLabelUsed, rosterProfile.name]
            );

            return (
              <div key={`${selectedSeasonEntry.season}-${iteration.rosterId}`} className="panel roster-iteration-card">
                <div className="roster-iteration-header">
                  <h3>{iterationDisplayName}</h3>
                  <span>{iteration.seriesPlayed} series</span>
                </div>

                <div className="profile-teams roster-iteration-block">
                  <div className="section-title">Starters</div>
                  <div className="tag-list">
                    {iteration.starters.map((starter) => (
                      <span
                        key={starter.id}
                        className="tag tag-current"
                        style={{ cursor: "pointer" }}
                        onClick={() => navigate(`/players/${starter.id}`)}
                      >
                        {starter.handle ?? starter.id}
                      </span>
                    ))}
                  </div>
                </div>

                {iteration.alternates.length > 0 && (
                  <div className="profile-teams roster-iteration-block">
                    <div className="section-title">Alternates</div>
                    <div className="tag-list">
                      {iteration.alternates.map((alt) => (
                        <span
                          key={alt.id}
                          className="tag"
                          style={{ cursor: "pointer" }}
                          onClick={() => navigate(`/players/${alt.id}`)}
                        >
                          {alt.handle ?? alt.id}
                          {alt.appearances != null ? ` (${alt.appearances})` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {iterationOtherNames.length > 0 && (
                  <div className="profile-teams roster-iteration-block">
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
                          title={`View ${teamName} team page`}
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

      <div className="profile-teams">
        <div className="section-title">Competed in Seasons</div>
        <div className="tag-list">
          {(rosterProfile.seasonsCompeted ?? []).map((season) => (
            <span key={season} className="tag">{season}</span>
          ))}
        </div>
      </div>

      {uniqueTeamNames(rosterProfile.otherTeamNames ?? [], [rosterProfile.name]).length > 0 && (
        <div className="profile-teams">
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
  );
}
