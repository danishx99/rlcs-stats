import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { RosterProfile, SeasonResponse, SeasonRow } from "../types/api";
import SeasonTable from "../components/SeasonTable";
import { formatRosterAlternates, formatRosterStarters } from "../utils/roster";

export default function RosterPage({
  filters
}: {
  filters: { season: string; split: string; event: string };
}) {
  const { rosterId } = useParams();
  const navigate = useNavigate();
  const [rosterProfile, setRosterProfile] = useState<RosterProfile | null>(null);
  const [rosterProfileLoading, setRosterProfileLoading] = useState(false);
  const [seasonRows, setSeasonRows] = useState<SeasonRow[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);

  const seasonTableRows = useMemo(() => {
    if (!rosterProfile) return [];
    return [
      {
        season: "All seasons",
        games: rosterProfile.games,
        seriesPlayed: rosterProfile.seriesPlayed,
        goals: rosterProfile.averages.goals,
        assists: rosterProfile.averages.assists,
        saves: rosterProfile.averages.saves,
        demos: rosterProfile.averages.demos
      },
      ...seasonRows
    ];
  }, [rosterProfile, seasonRows]);

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
    return <div className="page">Loading roster profile...</div>;
  }

  if (!rosterProfile) {
    return (
      <div className="page">
        <div className="empty-state">Roster not found.</div>
        <button className="ghost" onClick={() => navigate("/")}>Back to home</button>
      </div>
    );
  }

  const startersLabel = formatRosterStarters(rosterProfile.starters);
  const alternatesLabel = formatRosterAlternates(rosterProfile.alternates);

  return (
    <div className="page">
      <div className="profile-header">
        <div className="profile-info">
          <h1>{rosterProfile.name ?? "Roster"}</h1>
          <div className="profile-subtitle">{startersLabel}</div>
          <div className="profile-meta">
            <div>Alternates: {alternatesLabel}</div>
            <div>RLCS Debut: {rosterProfile.debut ?? "—"}</div>
            <div>Best Result: {rosterProfile.bestResult ?? "—"}</div>
          </div>
        </div>
      </div>

      <div className="section-header">
        <h2>Performance by season</h2>
        <div className="section-note">Series played | Goals | Assists | Saves | Demos</div>
      </div>

      {seasonLoading ? <div className="loading">Loading seasons...</div> : null}
      <SeasonTable rows={seasonTableRows} />
    </div>
  );
}
