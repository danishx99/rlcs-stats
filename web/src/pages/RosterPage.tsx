import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { MetaResponse, RosterProfile } from "../types/api";
import { proxyImageUrl } from "../utils/normalize";
import { formatRosterStarters } from "../utils/roster";

export default function RosterPage({
  filters: _filters,
  meta: _meta,
  onFiltersChange: _onFiltersChange
}: {
  filters: { season: string; split: string; event: string };
  meta: MetaResponse | null;
  onFiltersChange: (f: { season: string; split: string; event: string }) => void;
}) {
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
                <strong>{rosterProfile.debut ?? "—"}</strong>
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
          {selectedSeasonEntry.iterations.map((iteration) => (
            <div key={`${selectedSeasonEntry.season}-${iteration.rosterId}`} className="panel roster-iteration-card">
              <div className="roster-iteration-header">
                <h3>{iteration.teamLabelUsed ?? rosterProfile.name ?? "Team"}</h3>
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

              {(iteration.alsoCompetedUnder?.length ?? 0) > 0 && (
                <div className="profile-teams roster-iteration-block">
                  <div className="section-title">Also Competed Under</div>
                  <div className="tag-list">
                    {(iteration.alsoCompetedUnder ?? []).map((teamName) => (
                      <span key={teamName} className="tag">{teamName}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
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

      {(rosterProfile.otherTeamNames ?? []).length > 0 && (
        <div className="profile-teams">
          <div className="section-title">Also Competed Under</div>
          <div className="tag-list">
            {(rosterProfile.otherTeamNames ?? []).map((teamName) => (
              <span key={teamName} className="tag">{teamName}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
