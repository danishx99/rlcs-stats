import { Fragment } from "react";
import type { EventBracket, EventDetail, EventTeam } from "../../types/api";
import { placementLabel } from "../../utils/format";
import { proxyImageUrl } from "../../utils/normalize";
import PlayerNameWithPhoto from "../PlayerNameWithPhoto";
import TeamNameWithLogo from "../TeamNameWithLogo";

export type EventBracketPanelProps = {
  event: EventDetail;
  teams: EventTeam[];
  bracket: EventBracket | null;
  showAllPlacements: boolean;
  onToggleShowAllPlacements: () => void;
  topTeamsLimit: number;
};

/**
 * Top-Teams list (left) + Bracket image (right) for an event detail page.
 */
export default function EventBracketPanel({
  event,
  teams,
  bracket,
  showAllPlacements,
  onToggleShowAllPlacements,
  topTeamsLimit,
}: EventBracketPanelProps) {
  const isInProgress = event.status === "in_progress";
  const visibleTeams = showAllPlacements || isInProgress ? teams : teams.slice(0, topTeamsLimit);
  const isOnesEvent = event.mode === "1s";

  return (
    <div className="event-grid">
      <div className="event-panel event-panel--bracket panel">
        <div className="event-resource-header">
          <h3>
            {isInProgress
              ? "Current Standings"
              : showAllPlacements ? "All Placements" : "Top Teams"}
          </h3>
          {isInProgress ? (
            <span className="badge badge--in-progress">In Progress</span>
          ) : (
            <button
              type="button"
              className="ghost"
              onClick={onToggleShowAllPlacements}
            >
              {showAllPlacements ? "Show Top 8" : "Show All"}
            </button>
          )}
        </div>
        {visibleTeams.length > 0 ? (
          <ol className={`event-teams-list${isOnesEvent ? " event-teams-list--ones" : ""}`}>
            {visibleTeams.map((t, i) => {
              const prev = i > 0 ? visibleTeams[i - 1] : null;
              const isEliminated = t.isEliminated;
              const prevEliminated = prev ? prev.isEliminated : false;
              const showGroupHeader = isInProgress
                ? (isEliminated
                    ? (!prevEliminated || prev!.placementStart !== t.placementStart || prev!.placementEnd !== t.placementEnd)
                    : i === 0 || prevEliminated)
                : (!prev || prev.placementStart !== t.placementStart || prev.placementEnd !== t.placementEnd);
              const groupLabel = isInProgress && !isEliminated
                ? "TBD"
                : placementLabel(t.placementStart, t.placementEnd);
              return (
                <Fragment key={t.team}>
                  {showGroupHeader && (
                    <li className="event-team-group-label">
                      {groupLabel}
                    </li>
                  )}
                  <li>
                    <span className="event-team-rank">{isInProgress && !isEliminated ? "–" : i + 1}</span>
                    {isOnesEvent ? (
                      <strong>
                        <PlayerNameWithPhoto
                          name={t.team}
                          playerId={t.uniqueId ?? null}
                          photoUrl={t.photoUrl ?? null}
                          className="identity-inline--xl"
                        />
                      </strong>
                    ) : (
                      <strong>
                        <TeamNameWithLogo team={t.team} logoUrl={t.logoUrl} />
                      </strong>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ol>
        ) : (
          <p className="dash-search-status">No placement data for this event.</p>
        )}
      </div>
      <div className="event-panel panel">
        <div className="event-resource-header">
          <h3>Bracket</h3>
          {bracket?.liquipediaUrl && (
            <a href={bracket.liquipediaUrl} target="_blank" rel="noreferrer noopener">
              View on Liquipedia
            </a>
          )}
        </div>
        {bracket && proxyImageUrl(bracket.imageUrl, { size: 1024 }) ? (
          <a
            className="event-bracket-image-link"
            href={bracket.imageUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            <img
              className="event-bracket-image"
              src={proxyImageUrl(bracket.imageUrl, { size: 1024 })!}
              alt={`${event.name} bracket`}
              loading="lazy"
            />
          </a>
        ) : (
          <p className="dash-search-status">No bracket resources for this event.</p>
        )}
      </div>
    </div>
  );
}
