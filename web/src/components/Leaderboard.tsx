import type { LeaderboardResponse } from "../types/api";
import { formatStat } from "../utils/format";
import PlayerNameWithPhoto from "./PlayerNameWithPhoto";
import TeamNameWithLogo from "./TeamNameWithLogo";

type LeaderboardProps = {
  data: LeaderboardResponse;
  entityType?: "player" | "team" | "auto";
  showTeamLogos?: boolean;
  showTeams?: boolean;
  playerImageSize?: "default" | "large";
  showSecondaryValue?: boolean;
};

export default function Leaderboard({
  data,
  entityType = "auto",
  showTeamLogos = true,
  showTeams = true,
  playerImageSize = "default",
  showSecondaryValue = false
}: LeaderboardProps) {
  const playerClassName = playerImageSize === "large" ? "identity-inline--xl" : "";

  return (
    <ol className="rank-list">
      {data.rows.map((row, index) => {
        const secondaryValue = data.mode === "avg" ? row.totalValue : row.avgValue;
        const secondaryMode = data.mode === "avg" ? "total" : "avg";
        return (
        <li key={row.id}>
          <span className="rank">{index + 1}</span>
          <div>
            {entityType === "player" ? (
              <strong>
                <PlayerNameWithPhoto
                  name={row.label}
                  playerId={row.id}
                  photoUrl={row.photoUrl ?? null}
                  className={playerClassName || "identity-inline--lg"}
                />
              </strong>
            ) : entityType === "team" ? (
              <strong>
                <TeamNameWithLogo
                  team={row.label}
                  logoUrl={row.photoUrl ?? null}
                  className="identity-inline--lg"
                />
              </strong>
            ) : (
              <>
                <strong>
                  <PlayerNameWithPhoto
                    name={row.label}
                    playerId={row.id}
                    photoUrl={row.photoUrl ?? null}
                    className={playerClassName}
                  />
                </strong>
                {showTeams ? (
                  <span className="team-inline-list">
                    {row.teams.length ? (
                      showTeamLogos
                        ? row.teams.map((team) => (
                            <TeamNameWithLogo key={`${row.id}-${team}`} team={team} />
                          ))
                        : row.teams.join(" / ")
                    ) : (
                      "—"
                    )}
                  </span>
                ) : null}
              </>
            )}
          </div>
          <em>
            {formatStat(row.value, data.metric.format, data.mode)}
            {showSecondaryValue && secondaryValue != null ? (
              <span className="leaderboard-secondary-value">
                {" "}
                ({formatStat(secondaryValue, data.metric.format, secondaryMode)})
              </span>
            ) : null}
          </em>
        </li>
      )})}
    </ol>
  );
}
