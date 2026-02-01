import type { LeaderboardResponse } from "../types/api";
import { formatStat } from "../utils/format";

const TOP_LIMIT = 10;

type LeaderboardProps = {
  data: LeaderboardResponse;
};

export default function Leaderboard({ data }: LeaderboardProps) {
  return (
    <ol className="rank-list">
      {data.rows.slice(0, TOP_LIMIT).map((row, index) => (
        <li key={row.id}>
          <span className="rank">{index + 1}</span>
          <div>
            <strong>{row.label}</strong>
            <span>{row.teams.join(" / ")}</span>
          </div>
          <em>{formatStat(row.value, data.metric.format, data.mode)}</em>
        </li>
      ))}
    </ol>
  );
}
