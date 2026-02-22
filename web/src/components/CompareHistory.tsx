import type { CompareHistoryRow } from "../types/api";
import { entityLabel, formatSeriesLabel, scoreClass, scoreParts, teamLabel } from "../utils/compare";
import TeamNameWithLogo from "./TeamNameWithLogo";

const compareHistoryPageSize = 5;

type CompareHistoryProps = {
  rows: CompareHistoryRow[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export default function CompareHistory({ rows, page, totalPages, onPageChange }: CompareHistoryProps) {
  if (!rows.length) {
    return null;
  }

  return (
    <div className="compare-history">
      <div className="section-header">
        <h3>Series History</h3>
        <div className="section-note">{compareHistoryPageSize} per page</div>
      </div>
      <div className="history-list">
        {rows.map((row) => {
          const teams = row.teams ?? [];
          const teamA = teams[0];
          const teamB = teams[1];
          return (
            <div key={row.series_id} className="history-card">
              <div className="history-meta">{formatSeriesLabel(row)}</div>
              <div className="history-teams">
                <div className="history-team">
                  <div className={`history-team-name ${scoreClass(teamA, teamB)}`}>
                    <TeamNameWithLogo team={teamLabel(teamA)} />
                  </div>
                  <div className="history-players">{entityLabel(teamA)}</div>
                </div>
                <div className="history-score">
                  <div className={`score ${scoreClass(teamA, teamB)}`}>{scoreParts(teamA, teamB)}</div>
                </div>
                <div className="history-team">
                  <div className={`history-team-name ${scoreClass(teamB, teamA)}`}>
                    <TeamNameWithLogo team={teamLabel(teamB)} />
                  </div>
                  <div className="history-players">{entityLabel(teamB)}</div>
                </div>
                <div className="history-score">
                  <div className={`score ${scoreClass(teamB, teamA)}`}>{scoreParts(teamB, teamA)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="compare-history-pagination">
        <button
          className="ghost"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          Prev
        </button>
        <span>
          Page {page} / {totalPages}
        </span>
        <button
          className="ghost"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
