import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { PlayerProfile, SeasonResponse, SeasonRow } from "../types/api";
import SeasonTable from "../components/SeasonTable";
import { formatAliases } from "../utils/aliases";
import { computeAge, formatDate } from "../utils/date";
import { normalizeSocialLink, proxyImageUrl } from "../utils/normalize";

export default function PlayerPage({
  filters
}: {
  filters: { season: string; split: string; event: string };
}) {
  const { uniqueId } = useParams();
  const navigate = useNavigate();
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [playerProfileLoading, setPlayerProfileLoading] = useState(false);
  const [seasonRows, setSeasonRows] = useState<SeasonRow[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);

  const seasonTableRows = useMemo(() => {
    if (!playerProfile) return [];
    return [
      {
        season: "All seasons",
        games: playerProfile.games,
        seriesPlayed: playerProfile.seriesPlayed,
        goals: playerProfile.averages.goals,
        assists: playerProfile.averages.assists,
        saves: playerProfile.averages.saves,
        demos: playerProfile.averages.demos
      },
      ...seasonRows
    ];
  }, [playerProfile, seasonRows]);

  useEffect(() => {
    if (!uniqueId) return;
    const playerId = uniqueId;
    async function loadProfile() {
      setPlayerProfileLoading(true);
      try {
        const response = await api.playerProfile(playerId, {
          season: filters.season || undefined,
          split: filters.split || undefined,
          event: filters.event || undefined
        });
        setPlayerProfile(response.player);
      } catch (error) {
        console.error(error);
      } finally {
        setPlayerProfileLoading(false);
      }
    }

    loadProfile();
  }, [filters.event, filters.season, filters.split, uniqueId]);

  useEffect(() => {
    if (!uniqueId) return;
    const playerId = uniqueId;
    async function loadSeason() {
      setSeasonLoading(true);
      try {
        const response: SeasonResponse = await api.playerSeason(playerId, {
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
  }, [filters.event, filters.season, filters.split, uniqueId]);

  if (playerProfileLoading) {
    return <div className="page">Loading player profile...</div>;
  }

  if (!playerProfile) {
    return (
      <div className="page">
        <div className="empty-state">Player not found.</div>
        <button className="ghost" onClick={() => navigate("/")}>Back to home</button>
      </div>
    );
  }

  const aliases = formatAliases(playerProfile.aliases);
  const age = computeAge(playerProfile.dateOfBirth);
  const twitchLink = normalizeSocialLink(playerProfile.twitch, "twitch");
  const tiktokLink = normalizeSocialLink(playerProfile.tiktok, "tiktok");

  return (
    <div className="page">
      <div className="profile-header">
        <div className="profile-media">
          {playerProfile.photoUrl ? (
            <img
              src={proxyImageUrl(playerProfile.photoUrl) ?? undefined}
              alt={playerProfile.handle ?? playerProfile.playerName ?? "Player"}
              loading="lazy"
            />
          ) : (
            <div className="profile-avatar">{playerProfile.handle?.[0] ?? "?"}</div>
          )}
        </div>
        <div className="profile-info">
          <h1>{playerProfile.handle ?? playerProfile.playerName ?? "Player"}</h1>
          <div className="profile-subtitle">{playerProfile.playerName}</div>
          <div className="profile-meta">
            <div>Aliases: {aliases}</div>
            <div>Country: {playerProfile.country ?? "—"}</div>
            <div>Age: {age ?? "—"}</div>
            <div>RLCS Debut: {playerProfile.debut ?? "—"}</div>
            <div>Best Result: {playerProfile.bestResult ?? "—"}</div>
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
        </div>
      </div>

      <div className="section-header">
        <h2>Performance by season</h2>
        <div className="section-note">Series played | Goals | Assists | Saves | Demos</div>
      </div>

      {seasonLoading ? <div className="loading">Loading seasons...</div> : null}
      <SeasonTable rows={seasonTableRows} />

      <div className="profile-teams">
        <div className="section-title">Teams</div>
        <div className="tag-list">
          {playerProfile.teams.map((team) => (
            <span key={team} className="tag">
              {team}
            </span>
          ))}
        </div>
      </div>

      <div className="profile-dates">
        <div className="section-title">Dates</div>
        <div className="dates-grid">
          <div>
            <div className="label">Date of birth</div>
            <div>{formatDate(playerProfile.dateOfBirth)}</div>
          </div>
          <div>
            <div className="label">RLCS debut</div>
            <div>{playerProfile.debut ?? "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
