import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { LeaderboardResponse } from "../types/api";
import Leaderboard from "../components/Leaderboard";

export default function StatPage({
  filters
}: {
  filters: { season: string; split: string; event: string };
}) {
  const { statKey } = useParams();
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [leaderLoading, setLeaderLoading] = useState(false);
  const [leaderError, setLeaderError] = useState<string | null>(null);

  useEffect(() => {
    if (!statKey) return;
    async function loadLeaderboard() {
      setLeaderLoading(true);
      setLeaderError(null);
      try {
        const response = await api.statsTop({
          metric: statKey,
          mode: "avg",
          season: filters.season || undefined,
          split: filters.split || undefined,
          event: filters.event || undefined,
          limit: 10
        });
        setLeaderboard(response);
      } catch (error) {
        console.error(error);
        setLeaderError("Failed to load stat leaderboard");
      } finally {
        setLeaderLoading(false);
      }
    }

    loadLeaderboard();
  }, [filters.event, filters.season, filters.split, statKey]);

  if (leaderLoading) {
    return <div className="page">Loading stat leaderboard...</div>;
  }

  if (leaderError) {
    return (
      <div className="page">
        <div className="error">{leaderError}</div>
        <button className="ghost" onClick={() => navigate("/")}>Back to home</button>
      </div>
    );
  }

  if (!leaderboard) {
    return (
      <div className="page">
        <div className="empty-state">No leaderboard data.</div>
        <button className="ghost" onClick={() => navigate("/")}>Back to home</button>
      </div>
    );
  }

  const title = leaderboard.metric.label ?? "Stat";

  return (
    <div className="page">
      <div className="section-header">
        <h2>{title}</h2>
        <div className="section-note">Top 10</div>
      </div>
      <Leaderboard data={leaderboard} />
    </div>
  );
}
