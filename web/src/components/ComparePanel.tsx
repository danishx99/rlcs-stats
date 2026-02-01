import { useEffect, useMemo, useState } from "react";
import type {
  CompareHistoryRow,
  CompareHistoryTeam,
  CompareResponse,
  SearchResult,
  StatOption
} from "../types/api";
import { api } from "../api";
import { formatStat, formatValue } from "../utils/format";
import { formatSeriesLabel } from "../utils/compare";
import { formatDate } from "../utils/date";

export type ComparePanelProps = {
  compareMode: "players" | "rosters";
  compareSelection: SearchResult[];
  onRemove: (id: string) => void;
  filters: { season: string; split: string; event: string };
  statOptions: StatOption[];
  compareMetrics: string[];
};

export default function ComparePanel({
  compareMode,
  compareSelection,
  onRemove,
  filters,
  statOptions,
  compareMetrics
}: ComparePanelProps) {
  const [compareResults, setCompareResults] = useState<CompareResponse | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareHistory, setCompareHistory] = useState<CompareHistoryRow[]>([]);
  const [compareHistoryLoading, setCompareHistoryLoading] = useState(false);
  const [compareHistoryPage, setCompareHistoryPage] = useState(1);

  const compareIds = useMemo(() => compareSelection.map((item) => item.id), [compareSelection]);
  const compareMetricsList = useMemo(() => compareMetrics.join(","), [compareMetrics]);

  const compareHistoryPageSize = 5;
  const compareHistoryTotalPages = Math.max(
    1,
    Math.ceil(compareHistory.length / compareHistoryPageSize)
  );
  const compareHistoryStart = (compareHistoryPage - 1) * compareHistoryPageSize;
  const compareHistorySlice = compareHistory.slice(
    compareHistoryStart,
    compareHistoryStart + compareHistoryPageSize
  );

  useEffect(() => {
    setCompareHistoryPage(1);
  }, [compareSelection.length]);

  useEffect(() => {
    async function loadCompare() {
      if (compareSelection.length < 1 || !compareMetrics.length) {
        setCompareResults(null);
        setCompareLoading(false);
        return;
      }
      setCompareLoading(true);
      try {
        const response = await api.compare({
          type: compareMode,
          ids: compareIds.join(","),
          metrics: compareMetricsList,
          mode: "avg",
          season: filters.season || undefined,
          split: filters.split || undefined,
          event: filters.event || undefined
        });
        setCompareResults(response);
      } catch (error) {
        console.error(error);
        setCompareResults(null);
      } finally {
        setCompareLoading(false);
      }
    }

    loadCompare();
  }, [compareIds, compareMetricsList, compareMode, filters.event, filters.season, filters.split]);

  useEffect(() => {
    async function loadHistory() {
      if (compareSelection.length < 2) {
        setCompareHistory([]);
        return;
      }
      setCompareHistoryLoading(true);
      try {
        const response = await api.compareHistory({
          type: compareMode,
          ids: compareIds.join(","),
          season: filters.season || undefined,
          split: filters.split || undefined,
          event: filters.event || undefined
        });
        setCompareHistory(response.rows ?? []);
      } catch (error) {
        console.error(error);
      } finally {
        setCompareHistoryLoading(false);
      }
    }

    loadHistory();
  }, [compareIds, compareMode, compareSelection.length, filters.event, filters.season, filters.split]);

  return (
    <>
      <div className="panel-header">
        <div>
          <p className="panel-label">Stats View</p>
          <h2>{compareSelection.length < 2 ? "Player Statistics" : "Head-to-Head Comparison"}</h2>
        </div>
      </div>

      {compareLoading && <p className="empty">Loading statistics...</p>}
      {!compareLoading && (!compareResults || compareResults.rows.length === 0) && (
        <p className="empty">Select a player or roster to view stats.</p>
      )}
      {compareResults && compareResults.rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Games</th>
                {compareResults.metrics.map((metric) => (
                  <th key={metric.key}>{metric.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compareResults.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="cell-title">
                      <strong>{row.label}</strong>
                      {row.teams?.length ? <span>{row.teams.join(" / ")}</span> : null}
                    </div>
                  </td>
                  <td>{formatValue(row.games)}</td>
                  {compareResults.metrics.map((metric) => (
                    <td key={metric.key}>
                      {formatStat(
                        row.values[metric.key],
                        statOptions.find((option) => option.key === metric.key)?.format,
                        compareResults.mode
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {compareSelection.length >= 2 && (
        <>
          <div className="panel-header inline">
            <div>
              <p className="panel-label">Series History</p>
              <h4>Head-to-Head Series</h4>
            </div>
          </div>
          {compareHistoryLoading ? (
            <p className="empty">Loading series history...</p>
          ) : compareHistory.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Series</th>
                    <th>Team A</th>
                    <th>Team B</th>
                  </tr>
                </thead>
                <tbody>
                  {compareHistorySlice.map((row) => {
                    const teams = row.teams ?? [];
                    const teamA = teams[0];
                    const teamB = teams[1];
                    const teamLabel = (team?: CompareHistoryTeam) => team?.team ?? "—";
                    const entityLabel = (team?: CompareHistoryTeam) =>
                      team?.entities?.map((entity) => entity.label ?? entity.id).join(" / ") ?? "—";
                    const scoreParts = (team?: CompareHistoryTeam, other?: CompareHistoryTeam) => {
                      if (team?.wins === undefined || other?.wins === undefined) {
                        return { text: "—" };
                      }
                      return { text: `${team.wins}-${other.wins}` };
                    };
                    const scoreClass = (team?: CompareHistoryTeam, other?: CompareHistoryTeam) => {
                      if (team?.wins === undefined || other?.wins === undefined) return "";
                      if (team.wins > other.wins) return "score-win";
                      if (team.wins < other.wins) return "score-loss";
                      return "";
                    };

                    return (
                      <tr key={row.series_id}>
                        <td>{formatDate(row.date)}</td>
                        <td>{formatSeriesLabel(row)}</td>
                        <td>
                          <div className="cell-title">
                            <strong>{teamLabel(teamA)}</strong>
                            <span>
                              {entityLabel(teamA)} ·{" "}
                              <span className={scoreClass(teamA, teamB)}>
                                {scoreParts(teamA, teamB).text}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-title">
                            <strong>{teamLabel(teamB)}</strong>
                            <span>
                              {entityLabel(teamB)} ·{" "}
                              <span className={scoreClass(teamB, teamA)}>
                                {scoreParts(teamB, teamA).text}
                              </span>
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">No series found for this matchup.</p>
          )}

          {compareHistory.length > compareHistoryPageSize && (
            <div className="compare-history-pagination">
              <button
                type="button"
                className="ghost"
                onClick={() => setCompareHistoryPage((prev) => Math.max(1, prev - 1))}
                disabled={compareHistoryPage === 1}
              >
                Prev
              </button>
              <span className="pagination-status">
                Page {compareHistoryPage} of {compareHistoryTotalPages}
              </span>
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  setCompareHistoryPage((prev) => Math.min(compareHistoryTotalPages, prev + 1))
                }
                disabled={compareHistoryPage === compareHistoryTotalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
