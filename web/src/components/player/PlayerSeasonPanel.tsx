import type { SeasonRow } from "../../types/api";
import PanelState from "../ui/PanelState";
import SkeletonBlock from "../ui/SkeletonBlock";
import SeasonTable from "../SeasonTable";

export type PlayerSeasonPanelProps = {
  rows: SeasonRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  statMode: "avg" | "total";
  onStatModeChange: (mode: "avg" | "total") => void;
  gameMode: "1s" | "2s" | "3s";
  onGameModeChange: (mode: "1s" | "2s" | "3s") => void;
  includeLans: boolean;
  onIncludeLansChange: (next: boolean) => void;
  showLanToggle: boolean;
};

/**
 * "Perf by Season" card on the player profile page. Stat mode / game mode / LAN toggle
 * + season-by-season table. Fetching is owned by the parent PlayerPage.
 */
export default function PlayerSeasonPanel({
  rows,
  loading,
  error,
  onRetry,
  statMode,
  onStatModeChange,
  gameMode,
  onGameModeChange,
  includeLans,
  onIncludeLansChange,
  showLanToggle,
}: PlayerSeasonPanelProps) {
  return (
    <section className="panel player-season-card">
      <div className="section-header player-season-header">
        <h2>Perf by Season</h2>
        <div className="profile-filter-row">
          <div className="toggle">
            <button
              type="button"
              className={statMode === "avg" ? "active" : ""}
              onClick={() => onStatModeChange("avg")}
            >
              Per Game
            </button>
            <button
              type="button"
              className={statMode === "total" ? "active" : ""}
              onClick={() => onStatModeChange("total")}
            >
              Total
            </button>
          </div>
          {showLanToggle && (
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={includeLans}
                onChange={(e) => onIncludeLansChange(e.target.checked)}
                disabled={gameMode !== "3s"}
              />
              Include LAN Events
            </label>
          )}
          <select
            value={gameMode}
            onChange={(e) => {
              const mode = e.target.value as "1s" | "2s" | "3s";
              onGameModeChange(mode);
              if (mode !== "3s") {
                onIncludeLansChange(false);
              }
            }}
          >
            <option value="1s">1s</option>
            <option value="2s">2s</option>
            <option value="3s">3s</option>
          </select>
        </div>
      </div>
      {loading ? (
        <div className="skel-table" role="status" aria-busy="true">
          <div className="skel-table-row skel-season-row">
            <SkeletonBlock height={14} width="60%" />
            <SkeletonBlock height={14} />
            <SkeletonBlock height={14} />
            <SkeletonBlock height={14} />
            <SkeletonBlock height={14} />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`season-skel-${i}`} className="skel-table-row skel-season-row">
              <SkeletonBlock height={14} width="50%" />
              <SkeletonBlock height={14} />
              <SkeletonBlock height={14} />
              <SkeletonBlock height={14} />
              <SkeletonBlock height={14} />
            </div>
          ))}
        </div>
      ) : error ? (
        <PanelState state="error" message={error} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <PanelState state="empty" message="No season data available for this filter." />
      ) : (
        <SeasonTable rows={[...rows].reverse()} mode={statMode} />
      )}
    </section>
  );
}
