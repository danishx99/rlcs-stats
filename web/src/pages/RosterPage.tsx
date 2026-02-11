import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { MetaResponse, RosterProfile, SeasonResponse, SeasonRow } from "../types/api";
import { proxyImageUrl } from "../utils/normalize";
import SeasonTable from "../components/SeasonTable";
import { formatRosterStarters } from "../utils/roster";

export default function RosterPage({
  filters,
  meta,
  onFiltersChange
}: {
  filters: { season: string; split: string; event: string };
  meta: MetaResponse | null;
  onFiltersChange: (f: { season: string; split: string; event: string }) => void;
}) {
  const { rosterId } = useParams();
  const navigate = useNavigate();
  const [rosterProfile, setRosterProfile] = useState<RosterProfile | null>(null);
  const [rosterProfileLoading, setRosterProfileLoading] = useState(false);
  const [seasonRows, setSeasonRows] = useState<SeasonRow[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [showAllSeasons, setShowAllSeasons] = useState(false);

  const seasonTableRows = useMemo(() => {
    if (!rosterProfile) return [];

    const hasSeasonFilter = Boolean(filters.season);
    if (hasSeasonFilter) {
      return seasonRows;
    }

    const allSeasonsRow = {
      season: "All seasons",
      games: rosterProfile.games,
      seriesPlayed: rosterProfile.seriesPlayed,
      goals: rosterProfile.averages.goals,
      assists: rosterProfile.averages.assists,
      saves: rosterProfile.averages.saves,
      demos: rosterProfile.averages.demos
    };

    if (!showAllSeasons) {
      return [allSeasonsRow];
    }
    return [allSeasonsRow, ...seasonRows];
  }, [rosterProfile, seasonRows, showAllSeasons, filters.season]);

  useEffect(() => {
    if (!rosterId) return;
    const rosterKey = rosterId;
    async function loadRoster() {
      setRosterProfileLoading(true);
      try {
        const response = await api.rosterProfile(rosterKey, {
          season: filters.season || undefined,
          split: filters.split || undefined,
          event: filters.event || undefined
        });
        setRosterProfile(response.roster);
      } catch (error) {
        console.error(error);
      } finally {
        setRosterProfileLoading(false);
      }
    }

    loadRoster();
  }, [filters.event, filters.season, filters.split, rosterId]);

  useEffect(() => {
    if (!rosterId) return;
    const rosterKey = rosterId;
    async function loadSeason() {
      setSeasonLoading(true);
      try {
        const response: SeasonResponse = await api.rosterSeason(rosterKey, {
          mode: "avg",
          season: filters.season || undefined,
          split: filters.split || undefined,
          event: filters.event || undefined
        });
        setSeasonRows(response.rows);
      } catch (error) {
        console.error(error);
      } finally {
        setSeasonLoading(false);
      }
    }

    loadSeason();
  }, [filters.event, filters.season, filters.split, rosterId]);

  if (rosterProfileLoading) {
    return <div className="page page-no-nav">Loading roster profile...</div>;
  }

  if (!rosterProfile) {
    return (
      <div className="page page-no-nav">
        <button className="ghost back-button" onClick={() => navigate("/")}>
          ← Back to Dashboard
        </button>
        <div className="empty-state">Roster not found.</div>
      </div>
    );
  }

  const startersLabel = formatRosterStarters(rosterProfile.starters);
  const seasons = meta?.seasons ?? [];
  const splits = meta?.splits ?? [];
  const events = meta?.events ?? [];

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
            <h1>{rosterProfile.name ?? "Roster"}</h1>
            <div className="profile-subtitle">{startersLabel}</div>
            <div className="profile-meta">
              <div>
                <span>Games</span>
                <strong>{rosterProfile.games}</strong>
              </div>
              <div>
                <span>Series</span>
                <strong>{rosterProfile.seriesPlayed}</strong>
              </div>
              <div className="meta-accent">
                <span>RLCS Debut</span>
                <strong>{rosterProfile.debut ?? "—"}</strong>
              </div>
              <div className="meta-accent">
                <span>Best Result</span>
                <strong>{rosterProfile.bestResult ?? "—"}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-header">
        <h2>Performance by season</h2>
        <div className="profile-filter-row">
          <select
            value={filters.season}
            onChange={(e) =>
              onFiltersChange({ season: e.target.value, split: "", event: "" })
            }
          >
            <option value="">All Seasons</option>
            {seasons.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filters.split}
            onChange={(e) =>
              onFiltersChange({ season: filters.season, split: e.target.value, event: "" })
            }
            disabled={!filters.season}
          >
            <option value="">All Splits</option>
            {splits.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filters.event}
            onChange={(e) =>
              onFiltersChange({ season: filters.season, split: filters.split, event: e.target.value })
            }
            disabled={!filters.season || !filters.split}
          >
            <option value="">All Events</option>
            {events.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {!filters.season && seasonRows.length > 0 && (
            <button
              className="ghost"
              onClick={() => setShowAllSeasons(!showAllSeasons)}
            >
              {showAllSeasons ? "Show less" : "Show all seasons"}
            </button>
          )}
        </div>
      </div>

      {seasonLoading ? <div className="loading">Loading seasons...</div> : null}
      <SeasonTable rows={seasonTableRows} />

      <div className="section-divider" />

      <div className="profile-teams">
        <div className="section-title">Starters</div>
        <div className="tag-list">
          {rosterProfile.starters.map((starter) => (
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

      {rosterProfile.alternates.length > 0 && (
        <div className="profile-teams">
          <div className="section-title">Alternates</div>
          <div className="tag-list">
            {rosterProfile.alternates.map((alt) => (
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
    </div>
  );
}
