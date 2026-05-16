import { Link } from "react-router-dom";
import type { PlayerResultEvent } from "../../types/api";
import { buildEventPath } from "../../utils/event-routing";
import { formatPlacement } from "../../utils/format";
import PanelState from "../ui/PanelState";
import SkeletonBlock from "../ui/SkeletonBlock";
import TeamNameWithLogo from "../TeamNameWithLogo";

export type PlayerResultsPanelProps = {
  results: PlayerResultEvent[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  viewMode: "season" | "all";
  onViewModeChange: (mode: "season" | "all") => void;
  resultSeasons: string[];
  resultSeason: string;
  onResultSeasonChange: (season: string) => void;
};

/**
 * "Results" card on the player profile page. Season/All-Time toggle + season select
 * + per-event results table. Fetching is owned by the parent PlayerPage.
 */
export default function PlayerResultsPanel({
  results,
  loading,
  error,
  onRetry,
  viewMode,
  onViewModeChange,
  resultSeasons,
  resultSeason,
  onResultSeasonChange,
}: PlayerResultsPanelProps) {
  return (
    <section className="panel player-results-card">
      <div className="section-header">
        <h2>Results</h2>
        <div className="section-controls">
          <div className="toggle">
            <button
              type="button"
              className={viewMode === "season" ? "active" : ""}
              onClick={() => onViewModeChange("season")}
            >
              Season
            </button>
            <button
              type="button"
              className={viewMode === "all" ? "active" : ""}
              onClick={() => onViewModeChange("all")}
            >
              All-Time
            </button>
          </div>
          {viewMode === "season" && resultSeasons.length > 0 && (
            <select
              className="results-season-select"
              value={resultSeason}
              onChange={(e) => onResultSeasonChange(e.target.value)}
            >
              {resultSeasons.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="skel-table" role="status" aria-busy="true">
          <div className="skel-table-header skel-results-row">
            <SkeletonBlock height={12} width="40%" />
            <SkeletonBlock height={12} width="60%" />
            <SkeletonBlock height={12} width="50%" />
            <SkeletonBlock height={12} width="40%" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`results-skel-${i}`} className="skel-table-row skel-results-row">
              <SkeletonBlock height={14} width={`${70 - i * 6}%`} />
              <SkeletonBlock height={14} width="50%" />
              <SkeletonBlock height={14} width={`${60 - i * 5}%`} />
              <SkeletonBlock height={14} width="55%" />
            </div>
          ))}
        </div>
      ) : error ? (
        <PanelState state="error" message={error} onRetry={onRetry} />
      ) : results.length === 0 ? (
        <PanelState
          state="empty"
          message={viewMode === "season" ? "No event results found for this season." : "No event results found."}
        />
      ) : (
        <div className="results-table-wrap">
          <table className="results-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Placement</th>
                <th>Opponent</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {results.map((event) => {
                const s = event.series[0];
                const won = s?.wonSeries ?? false;
                const isLanResult = event.scope === "international";
                const eventLabel = [event.split, event.event].filter(Boolean).join(" / ");
                const eventHref = event.eventId
                  ? buildEventPath(event.eventId)
                  : null;
                const placement = isLanResult
                  ? "—"
                  : event.status === "in_progress"
                    ? "In Progress"
                    : formatPlacement(
                        event.placement,
                        event.placementStart,
                        event.placementEnd
                      );
                const isChampion =
                  !isLanResult && (
                    (event.placementStart === 1 && event.placementEnd === 1) || placement === "1st"
                  );
                return (
                  <tr
                    key={
                      event.eventId ??
                      `${event.season}-${event.split}-${event.mode}-${event.scope}-${event.tier}-${event.event}`
                    }
                    className={won ? "results-row--win" : "results-row--loss"}
                  >
                    <td className="results-cell-event">
                      {eventHref ? (
                        <Link className="inline-link" to={eventHref}>
                          {eventLabel || event.event}
                        </Link>
                      ) : (
                        eventLabel || "—"
                      )}
                    </td>
                    <td>
                      <span className={`results-placement${isChampion ? " results-placement--gold" : ""}`}>
                        {placement}
                      </span>
                    </td>
                    <td className="results-cell-opponent">
                      {s?.opponent ? <TeamNameWithLogo team={s.opponent} link={!isLanResult} /> : "—"}
                    </td>
                    <td className="results-cell-score">
                      {s ? (
                        <>
                          <span className={won ? "score-win" : "score-loss"}>{s.playerWins}</span>
                          <span className="score-dash"> - </span>
                          <span className={won ? "score-loss" : "score-win"}>{s.opponentWins}</span>
                        </>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
