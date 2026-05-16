import type { LeaderboardResponse, StatCategory, StatOption } from "../../types/api";
import ArenaFilter from "../ArenaFilter";
import Leaderboard from "../Leaderboard";
import PanelState from "../ui/PanelState";
import SkeletonRows from "../ui/SkeletonRows";
import StatPicker from "../StatPicker";

export type CoreLeaderboardItem = { title: string; data: LeaderboardResponse };

export type EventLeaderboardsPanelProps = {
  leaderboardMode: "avg" | "total";
  onLeaderboardModeChange: (mode: "avg" | "total") => void;
  phaseOptions: string[];
  selectedPhase: string;
  onSelectedPhaseChange: (phase: string) => void;
  dayOptions: string[];
  selectedDay: string;
  onSelectedDayChange: (day: string) => void;
  arenas: string[];
  effectiveArena: string;
  onArenaChange: (arena: string) => void;

  coreLeaderboardItems: { key: string; title: string }[];
  coreLeaderboards: CoreLeaderboardItem[];
  leaderboardsLoading: boolean;

  statCategories: StatCategory[];
  selectedStats: string[];
  onToggleStat: (key: string) => void;
  visibleStatOptions: StatOption[];

  selectedExtraStats: string[];
  leaderboardMap: Map<string, LeaderboardResponse>;
  loadingStats: Set<string>;
  statLoadErrors: Map<string, string>;
  allCategoryStats: StatOption[];
};

/**
 * Renders the event leaderboards stack: filter controls, core leaderboard grid,
 * "Pick a Stat" picker, and the extra-stats grid for user-selected metrics.
 * All fetching and state remain in the parent EventPage; this component is presentational.
 */
export default function EventLeaderboardsPanel({
  leaderboardMode,
  onLeaderboardModeChange,
  phaseOptions,
  selectedPhase,
  onSelectedPhaseChange,
  dayOptions,
  selectedDay,
  onSelectedDayChange,
  arenas,
  effectiveArena,
  onArenaChange,
  coreLeaderboardItems,
  coreLeaderboards,
  leaderboardsLoading,
  statCategories,
  selectedStats,
  onToggleStat,
  visibleStatOptions,
  selectedExtraStats,
  leaderboardMap,
  loadingStats,
  statLoadErrors,
  allCategoryStats,
}: EventLeaderboardsPanelProps) {
  return (
    <>
      <div className="event-leaderboard-controls">
        <div className="tabs">
          <button
            type="button"
            className={`tab${leaderboardMode === "avg" ? " active" : ""}`}
            onClick={() => onLeaderboardModeChange("avg")}
          >
            Per Game
          </button>
          <button
            type="button"
            className={`tab${leaderboardMode === "total" ? " active" : ""}`}
            onClick={() => onLeaderboardModeChange("total")}
          >
            Total
          </button>
        </div>
        {phaseOptions.length > 0 && (
          <select
            className="event-filter-select"
            value={selectedPhase === "all" ? "" : selectedPhase}
            onChange={(e) => onSelectedPhaseChange(e.target.value || "all")}
          >
            <option value="">All Phases</option>
            {phaseOptions.map((phase) => (
              <option key={phase} value={phase}>{phase}</option>
            ))}
          </select>
        )}
        {dayOptions.length > 0 && (
          <select
            className="event-filter-select"
            value={selectedDay === "all" ? "" : selectedDay}
            onChange={(e) => onSelectedDayChange(e.target.value || "all")}
          >
            <option value="">All Days</option>
            {dayOptions.map((day) => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        )}
        <ArenaFilter
          arenas={arenas}
          value={effectiveArena}
          onChange={onArenaChange}
        />
      </div>

      {leaderboardsLoading ? (
        <div className="event-grid event-grid--stats">
          {coreLeaderboardItems.map((item) => (
            <div key={item.key} className="event-panel panel">
              <h3>{item.title}</h3>
              <SkeletonRows rows={10} rowHeight={26} />
            </div>
          ))}
        </div>
      ) : coreLeaderboards.length > 0 ? (
        <div className="event-grid event-grid--stats">
          {coreLeaderboards.map((item) => (
            <div key={item.data.metric.key} className="event-panel panel">
              <h3>{item.title}</h3>
              <Leaderboard data={item.data} showTeamLogos={false} showTeams={false} playerImageSize="large" />
            </div>
          ))}
        </div>
      ) : null}

      <div className="event-pick-stat panel">
        <div className="event-pick-stat-header">
          <h3>Pick a Stat</h3>
          {statCategories.length > 0 && (
            <StatPicker
              categories={statCategories}
              selected={selectedStats}
              onToggle={onToggleStat}
            />
          )}
        </div>
        {visibleStatOptions.length > 0 && (
          <div className="event-pick-stat-toggles">
            {visibleStatOptions.map((opt) => (
              <label key={opt.key} className="stat-toggle">
                <input
                  type="checkbox"
                  checked={selectedStats.includes(opt.key)}
                  onChange={() => onToggleStat(opt.key)}
                />
                <span className="stat-toggle-label">{opt.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {selectedExtraStats.length > 0 && (
        <div className="event-pick-stat-grid">
          {selectedExtraStats.map((key) => {
            const data = leaderboardMap.get(key);
            const isLoading = loadingStats.has(key);
            const label = allCategoryStats.find((s) => s.key === key)?.label ?? key;
            return (
              <div key={key} className="event-pick-stat-card panel">
                <h4>{label}</h4>
                {isLoading && !data ? <SkeletonRows rows={6} rowHeight={26} /> : null}
                {!isLoading && statLoadErrors.get(key) ? (
                  <PanelState state="error" message={`Failed to load ${label}.`} />
                ) : null}
                {!isLoading && data && data.rows.length > 0 && (
                  <Leaderboard data={data} showTeamLogos={false} showTeams={false} playerImageSize="large" />
                )}
                {!isLoading && data && data.rows.length === 0 && (
                  <p className="dash-search-status">No data for this stat.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
