import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  CompareHistoryRow,
  CompareHistoryTeam,
  CompareResponse,
  SearchResult,
  StatOption
} from "../types/api";
import { api } from "../api";
import { formatStat, formatValue } from "../utils/format";
import { seriesLabelParts } from "../utils/compare";
import { formatDate } from "../utils/date";
import { buildEventPath } from "../utils/event-routing";
import PlayerNameWithPhoto from "./PlayerNameWithPhoto";
import TeamNameWithLogo from "./TeamNameWithLogo";
import type { Filters } from "../types/ui";
import PanelState from "./ui/PanelState";
import SkeletonBlock from "./ui/SkeletonBlock";

export type ComparePanelProps = {
  compareMode: "players" | "rosters";
  compareSelection: SearchResult[];
  onRemove: (id: string) => void;
  filters: Filters;
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
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareHistory, setCompareHistory] = useState<CompareHistoryRow[]>([]);
  const [compareHistoryTotal, setCompareHistoryTotal] = useState(0);
  const [compareHistoryLoading, setCompareHistoryLoading] = useState(false);
  const [compareHistoryError, setCompareHistoryError] = useState<string | null>(null);
  const [compareHistoryPage, setCompareHistoryPage] = useState(1);

  const compareIds = useMemo(() => compareSelection.map((item) => item.id), [compareSelection]);
  const compareIdsKey = useMemo(() => compareIds.join(","), [compareIds]);
  const compareMetricsList = useMemo(() => compareMetrics.join(","), [compareMetrics]);

  const compareHistoryPageSize = 5;
  const compareHistoryTotalPages = Math.max(
    1,
    Math.ceil(compareHistoryTotal / compareHistoryPageSize)
  );
  const identityNode = (rowId: string, rowLabel: string) => {
    const selectedEntry = compareSelection.find((entry) => entry.id === rowId);
    if (compareMode === "rosters") {
      return (
        <TeamNameWithLogo
          team={rowLabel}
          logoUrl={selectedEntry?.meta?.photoUrl ?? null}
          rosterId={rowId}
        />
      );
    }
    return (
      <PlayerNameWithPhoto
        name={rowLabel}
        playerId={rowId}
        photoUrl={selectedEntry?.meta?.photoUrl ?? null}
      />
    );
  };

  useEffect(() => {
    setCompareHistoryPage(1);
  }, [compareIdsKey, compareMode, filters.event, filters.season, filters.split]);

  useEffect(() => {
    async function loadCompare() {
      if (compareSelection.length < 1 || !compareMetrics.length) {
        setCompareResults(null);
        setCompareLoading(false);
        setCompareError(null);
        return;
      }
      setCompareLoading(true);
      setCompareError(null);
      try {
        const response = await api.compare({
          type: compareMode,
          ids: compareIds.join(","),
          metrics: compareMetricsList,
          mode: "avg",
          gameMode: filters.mode || undefined,
          scope: filters.scope || undefined,
          tier: filters.tier || undefined,
          season: filters.season || undefined,
          split: filters.split || undefined,
          event: filters.event || undefined
        });
        setCompareResults(response);
      } catch (error) {
        console.error(error);
        setCompareResults(null);
        setCompareError("Failed to load comparison data.");
      } finally {
        setCompareLoading(false);
      }
    }

    loadCompare();
  }, [compareIds, compareMetricsList, compareMode, filters.event, filters.mode, filters.scope, filters.season, filters.split, filters.tier]);

  useEffect(() => {
    async function loadHistory() {
      if (compareSelection.length < 2) {
        setCompareHistory([]);
        setCompareHistoryTotal(0);
        setCompareHistoryError(null);
        return;
      }
      setCompareHistoryLoading(true);
      setCompareHistoryError(null);
      try {
        const offset = (compareHistoryPage - 1) * compareHistoryPageSize;
        const response = await api.compareHistory({
          type: compareMode,
          ids: compareIdsKey,
          gameMode: filters.mode || undefined,
          scope: filters.scope || undefined,
          tier: filters.tier || undefined,
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
        setCompareHistoryError("Failed to load series history.");
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
    filters.mode,
    filters.scope,
    filters.season,
    filters.split,
    filters.tier
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
      {compareLoading ? (
        <div className="skel-compare-grid" role="status" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`compare-skel-${i}`} className="skel-compare-card">
              <SkeletonBlock height={14} width="50%" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={`compare-entry-${i}-${j}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <SkeletonBlock width={20} height={20} rounded="pill" />
                  <SkeletonBlock height={12} width={`${70 - j * 10}%`} />
                  <SkeletonBlock height={12} width={40} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {!compareLoading && compareError ? <PanelState state="error" message={compareError} /> : null}
      {!compareLoading && !compareError && compareSelection.length === 0 ? (
        <PanelState state="empty" message="Search and add 2-6 players or teams to compare." />
      ) : null}
      {!compareLoading && !compareError && compareSelection.length === 1 ? (
        <PanelState state="empty" message="Add one more player or team to unlock head-to-head comparison." />
      ) : null}
      {!compareLoading && !compareError && compareMetrics.length === 0 ? (
        <PanelState state="empty" message="Select at least one metric to compare." />
      ) : null}
      {!compareLoading && !compareError && compareSelection.length > 0 && compareMetrics.length > 0 && (!compareResults || compareResults.rows.length === 0) ? (
        <PanelState state="empty" message="No comparison data found for the selected filters." />
      ) : null}
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
                      <span className="sg-name">
                        {identityNode(row.id, row.label)}
                      </span>
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
                        <span className="sg-name">
                          {identityNode(row.id, row.label)}
                        </span>
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
            <div className="skel-table" role="status" aria-busy="true">
              <div className="skel-table-header" style={{ gridTemplateColumns: "80px 2fr 1.5fr 1.5fr" }}>
                <SkeletonBlock height={12} width="70%" />
                <SkeletonBlock height={12} width="40%" />
                <SkeletonBlock height={12} width="50%" />
                <SkeletonBlock height={12} width="50%" />
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`history-skel-${i}`} className="skel-table-row" style={{ gridTemplateColumns: "80px 2fr 1.5fr 1.5fr" }}>
                  <SkeletonBlock height={14} width="60%" />
                  <SkeletonBlock height={14} width={`${65 - i * 5}%`} />
                  <SkeletonBlock height={14} width={`${55 - i * 4}%`} />
                  <SkeletonBlock height={14} width={`${55 - i * 4}%`} />
                </div>
              ))}
            </div>
          ) : compareHistoryError ? (
            <PanelState state="error" message={compareHistoryError} />
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
                    const eventHref = row.event_id
                      ? buildEventPath(row.event_id)
                      : null;
                    const { prefix, event, suffix } = seriesLabelParts(row);
                    const eventMetaLabel = [row.season, row.split, row.event].filter(Boolean).join(" · ");
                    const entityLabel = (team?: CompareHistoryTeam) => {
                      const entities = team?.entities ?? [];
                      if (!entities.length) return "—";
                      return entities.map((entity, index) => {
                        const label = entity.label ?? entity.id;
                        if (!entity.id) {
                          return <span key={`${label}-${index}`}>{label}</span>;
                        }
                        const href = compareMode === "players"
                          ? `/players/${encodeURIComponent(entity.id)}`
                          : `/rosters/${encodeURIComponent(entity.id)}`;
                        return (
                          <span key={`${entity.id}-${index}`}>
                            <Link className="inline-link" to={href} onClick={(event) => event.stopPropagation()}>
                              {label}
                            </Link>
                            {index < entities.length - 1 ? " / " : ""}
                          </span>
                        );
                      });
                    };
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
                    const teamLabel = (team?: CompareHistoryTeam) => team?.team ?? "—";

                    return (
                      <tr key={row.series_id}>
                        <td>{formatDate(row.date)}</td>
                        <td>
                          {eventHref && eventMetaLabel ? (
                            <Link className="inline-link" to={eventHref}>{eventMetaLabel}</Link>
                          ) : (
                            [prefix, event].filter(Boolean).join(" · ") || "Series"
                          )}
                          {suffix ? <> · {suffix}</> : null}
                        </td>
                        <td>
                          <div className="cell-title">
                            <strong className={scoreClass(teamA, teamB)}>
                              {scoreParts(teamA, teamB).text}
                            </strong>
                            <span className="cell-team-name">
                              <TeamNameWithLogo team={teamLabel(teamA)} />
                            </span>
                            {compareMode === "players" ? (
                              <span className="cell-entity-list">
                                {entityLabel(teamA)}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <div className="cell-title">
                            <strong className={scoreClass(teamB, teamA)}>
                              {scoreParts(teamB, teamA).text}
                            </strong>
                            <span className="cell-team-name">
                              <TeamNameWithLogo team={teamLabel(teamB)} />
                            </span>
                            {compareMode === "players" ? (
                              <span className="cell-entity-list">
                                {entityLabel(teamB)}
                              </span>
                            ) : null}
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
