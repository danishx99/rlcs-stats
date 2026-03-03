import type { SeasonRow } from "../types/api";

export default function SeasonTable({ rows }: { rows: SeasonRow[] }) {
  return (
    <div className="season-table-wrap">
      <div className="season-table">
        <div className="season-row season-header">
          <div>Season</div>
          <div>Series</div>
          <div>Games</div>
          <div>Goals</div>
          <div>Assists</div>
          <div>Saves</div>
          <div>Demos</div>
        </div>
        {rows.map((row) => (
          <div key={row.season} className="season-row">
            <div>{row.season}</div>
            <div>{row.seriesPlayed}</div>
            <div>{row.games}</div>
            <div>{row.goals.toFixed(1)}</div>
            <div>{row.assists.toFixed(1)}</div>
            <div>{row.saves.toFixed(1)}</div>
            <div>{row.demos.toFixed(1)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
