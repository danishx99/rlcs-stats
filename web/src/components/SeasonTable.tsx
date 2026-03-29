import type { SeasonRow } from "../types/api";

type SeasonTableProps = {
  rows: SeasonRow[];
  mode: "avg" | "total";
};

function formatSeasonStat(value: number, mode: "avg" | "total") {
  if (mode === "avg") return value.toFixed(1);
  return Math.round(value).toLocaleString("en-US");
}

export default function SeasonTable({ rows, mode }: SeasonTableProps) {
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
        {rows.map((row) => {
          const goalsSecondary = mode === "avg" ? row.goalsTotal : row.goalsAvg;
          const assistsSecondary = mode === "avg" ? row.assistsTotal : row.assistsAvg;
          const savesSecondary = mode === "avg" ? row.savesTotal : row.savesAvg;
          const demosSecondary = mode === "avg" ? row.demosTotal : row.demosAvg;
          const secondaryMode = mode === "avg" ? "total" : "avg";

          return (
            <div key={row.season} className="season-row">
              <div>{row.season}</div>
              <div>{row.seriesPlayed}</div>
              <div>{row.games}</div>
              <div>{formatSeasonStat(row.goals, mode)} <span className="season-secondary">({formatSeasonStat(goalsSecondary, secondaryMode)})</span></div>
              <div>{formatSeasonStat(row.assists, mode)} <span className="season-secondary">({formatSeasonStat(assistsSecondary, secondaryMode)})</span></div>
              <div>{formatSeasonStat(row.saves, mode)} <span className="season-secondary">({formatSeasonStat(savesSecondary, secondaryMode)})</span></div>
              <div>{formatSeasonStat(row.demos, mode)} <span className="season-secondary">({formatSeasonStat(demosSecondary, secondaryMode)})</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
