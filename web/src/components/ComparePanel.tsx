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
  const [compareHistoryTotal, setCompareHistoryTotal] = useState(0);
  const [compareHistoryLoading, setCompareHistoryLoading] = useState(false);
  const [compareHistoryPage, setCompareHistoryPage] = useState(1);

  const compareIds = useMemo(() => compareSelection.map((item) => item.id), [compareSelection]);
  const compareIdsKey = useMemo(() => compareIds.join(","), [compareIds]);
  const compareMetricsList = useMemo(() => compareMetrics.join(","), [compareMetrics]);

  const compareHistoryPageSize = 5;
  const compareHistoryTotalPages = Math.max(
    1,
    Math.ceil(compareHistoryTotal / compareHistoryPageSize)
  );

  useEffect(() => {
    setCompareHistoryPage(1);
  }, [compareIdsKey, compareMode, filters.event, filters.season, filters.split]);

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
        setCompareHistoryTotal(0);
        return;
      }
      setCompareHistoryLoading(true);
      try {
        const offset = (compareHistoryPage - 1) * compareHistoryPageSize;
        const response = await api.compareHistory({
          type: compareMode,
          ids: compareIdsKey,
          season: filters.season || undefined,
          split: filters.split || undefined,
          event: filters.event || undefined,
          limit: compareHistoryPageSize,
          offset
        });
        setCompareHistory(response.rows ?? []);
        setCompareHistoryTotal(response.total ?? 0);
      } catch (error) {
        console.error(error);
        setCompareHistory([]);
        setCompareHistoryTotal(0);
      } finally {
        setCompareHistoryLoading(false);
      }
    }

    loadHistory();
  }, [
    compareHistoryPage,
    compareIdsKey,
    compareMode,
    compareSelection.length,
    filters.event,
    filters.season,
    filters.split
  ]);

  const bestValues = useMemo(() => {
    if (!compareResults || compareResults.rows.length < 2) return {};
    const bests: Record<string, number> = {};
    for (const metric of compareResults.metrics) {
      let max = -Infinity;
      for (const row of compareResults.rows) {
        const val = row.values[metric.key];
        if (val !== null && val !== undefined && val > max) {
          max = val;
        }
      }
      if (max !== -Infinity) {
        bests[metric.key] = max;
      }
    }
    return bests;
  }, [compareResults]);

  return (
    <>
      {compareLoading && <p className="empty">Loading statistics...</p>}
      {!compareLoading && (!compareResults || compareResults.rows.length === 0) && (
        <p className="empty">Select a player or roster to view stats.</p>
      )}
      {compareResults && compareResults.rows.length > 0 && (
        <div className="sg-grid">
          {/* Games card */}
          <div className="sg-card">
            <div className="sg-card-label">Games</div>
            {[...compareResults.rows]
              .sort((a, b) => (b.games ?? 0) - (a.games ?? 0))
              .map((row, rank) => {
                const maxGames = Math.max(...compareResults.rows.map((r) => r.games ?? 0));
                const pct = maxGames > 0 ? ((row.games ?? 0) / maxGames) * 100 : 0;
                const isBest = rank === 0 && compareResults.rows.length > 1;
                return (
                  <div key={row.id}>
                    <div className={`sg-entry${isBest ? " sg-best" : ""}`}>
                      <span className="sg-rank">{rank + 1}</span>
                      <span className="sg-name">{row.label}</span>
                      <span className="sg-team">{row.teams?.[0] ?? ""}</span>
                      <span className="sg-val">{formatValue(row.games)}</span>
                    </div>
                    <div className="sg-bar">
                      <div
                        className={`sg-bar-fill${isBest ? " sg-bar-best" : ""}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
          {/* Metric cards */}
          {compareResults.metrics.map((metric) => {
            const format = statOptions.find((o) => o.key === metric.key)?.format;
            const sorted = [...compareResults.rows].sort(
              (a, b) => (b.values[metric.key] ?? 0) - (a.values[metric.key] ?? 0)
            );
            const maxVal = Math.max(
              ...compareResults.rows.map((r) => r.values[metric.key] ?? 0)
            );
            return (
              <div key={metric.key} className="sg-card">
                <div className="sg-card-label">{metric.label}</div>
                {sorted.map((row, rank) => {
                  const val = row.values[metric.key];
                  const pct = maxVal > 0 ? ((val ?? 0) / maxVal) * 100 : 0;
                  const isBest = rank === 0 && compareResults.rows.length > 1;
                  return (
                    <div key={row.id}>
                      <div className={`sg-entry${isBest ? " sg-best" : ""}`}>
                        <span className="sg-rank">{rank + 1}</span>
                        <span className="sg-name">{row.label}</span>
                        <span className="sg-team">{row.teams?.[0] ?? ""}</span>
                        <span className="sg-val">
                          {formatStat(val, format, compareResults.mode)}
                        </span>
                      </div>
                      <div className="sg-bar">
                        <div
                          className={`sg-bar-fill${isBest ? " sg-bar-best" : ""}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
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
                  {compareHistory.map((row) => {
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
                            <strong className={scoreClass(teamA, teamB)}>{teamLabel(teamA)}</strong>
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
                            <strong className={scoreClass(teamB, teamA)}>{teamLabel(teamB)}</strong>
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

          {compareHistoryTotal > compareHistoryPageSize && (
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
