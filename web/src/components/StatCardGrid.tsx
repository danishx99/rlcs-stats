import type { LeaderboardResponse } from "../types/api";
import Leaderboard from "./Leaderboard";
import PanelState from "./ui/PanelState";
import SkeletonRows from "./ui/SkeletonRows";

type StatCardGridProps = {
  orderedStats: string[];
  dataByKey: Map<string, LeaderboardResponse>;
  loadingByKey: Set<string>;
  errorByKey: Map<string, string>;
  statLabels: Map<string, string>;
  entityType: "player" | "team";
  onRemove: (key: string) => void;
};

export default function StatCardGrid({
  orderedStats,
  dataByKey,
  loadingByKey,
  errorByKey,
  statLabels,
  entityType,
  onRemove,
}: StatCardGridProps) {
  const showRemove = orderedStats.length > 1;

  return (
    <div className="event-pick-stat-grid">
      {orderedStats.map((key) => {
        const data = dataByKey.get(key);
        const isLoading = loadingByKey.has(key);
        const errMessage = errorByKey.get(key);
        const label = statLabels.get(key) ?? data?.metric?.label ?? key;
        return (
          <div key={key} className="event-pick-stat-card panel">
            <div className="stat-card-header">
              <h4>{label}</h4>
              {showRemove ? (
                <button
                  type="button"
                  className="stat-card-remove"
                  aria-label={`Remove ${label}`}
                  title={`Remove ${label}`}
                  onClick={() => onRemove(key)}
                >
                  &times;
                </button>
              ) : null}
            </div>
            {isLoading && !data ? <SkeletonRows rows={6} rowHeight={26} /> : null}
            {!isLoading && !data && errMessage ? (
              <PanelState state="error" message={`Failed to load ${label}.`} />
            ) : null}
            {data && data.rows.length > 0 ? (
              <Leaderboard
                data={data}
                entityType={entityType}
                showTeamLogos={false}
                showTeams={false}
                playerImageSize="large"
                showSecondaryValue
              />
            ) : null}
            {!isLoading && data && data.rows.length === 0 ? (
              <PanelState state="empty" message="No data for this stat." />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
