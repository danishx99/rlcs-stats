import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import type { SeriesDetail, SeriesListRow, SeriesMetaResponse } from "../types/api";
import { formatDate } from "../utils/date";
import { buildEventPath } from "../utils/event-routing";
import TeamNameWithLogo from "../components/TeamNameWithLogo";

type SeriesFilters = {
  season: string;
  split: string;
  event: string;
  stage: string;
  team: string;
  team2: string;
};

const DEFAULT_FILTERS: SeriesFilters = {
  season: "",
  split: "",
  event: "",
  stage: "",
  team: "",
  team2: ""
};

function scoreClass(aWins: number, bWins: number) {
  if (aWins > bWins) return "score-win";
  if (aWins < bWins) return "score-loss";
  return "";
}

function seriesContext(row: SeriesListRow | SeriesDetail | null) {
  if (!row) {
    return {
      title: "Series",
      subtitle: ""
    };
  }

  const title = [row.season, row.split, row.event].filter(Boolean).join(" · ") || "Series";
  const subtitle = [
    row.stage,
    row.round,
    row.day !== null ? `Day ${row.day}` : null,
    row.bestOf !== null ? `Bo${row.bestOf}` : null,
    row.date ? formatDate(row.date) : null
  ]
    .filter(Boolean)
    .join(" · ");

  return { title, subtitle };
}

export default function SeriesPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<SeriesFilters>(DEFAULT_FILTERS);
  const [meta, setMeta] = useState<SeriesMetaResponse | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [seriesRows, setSeriesRows] = useState<SeriesListRow[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [seriesDetailCache, setSeriesDetailCache] = useState<Record<string, SeriesDetail>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const teamOptions = meta?.teams ?? [];
  const team2Options = filters.team
    ? teamOptions.filter((team) => team !== filters.team)
    : teamOptions;

  const selectedSeriesSummary = useMemo(
    () => (selectedSeriesId ? seriesRows.find((row) => row.seriesId === selectedSeriesId) ?? null : null),
    [selectedSeriesId, seriesRows]
  );
  const selectedSeriesDetail = selectedSeriesId ? seriesDetailCache[selectedSeriesId] ?? null : null;
  const selectedSeries = selectedSeriesDetail ?? selectedSeriesSummary;

  useEffect(() => {
    let cancelled = false;

    async function loadMeta() {
      try {
        const response = await api.seriesMeta({
          season: filters.season || undefined,
          split: filters.split || undefined,
          event: filters.event || undefined,
          stage: filters.stage || undefined
        });
        if (cancelled) return;

        setMeta(response);
        setMetaError(null);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setMetaError("Failed to load series filters");
        }
      }
    }

    loadMeta();

    return () => {
      cancelled = true;
    };
  }, [filters.event, filters.season, filters.split, filters.stage]);

  useEffect(() => {
    let cancelled = false;

    async function loadSeries() {
      setSeriesLoading(true);
      setSeriesError(null);
      try {
        const response = await api.seriesList({
          season: filters.season || undefined,
          split: filters.split || undefined,
          event: filters.event || undefined,
          stage: filters.stage || undefined,
          team: filters.team || undefined,
          team2: filters.team2 || undefined
        });
        if (cancelled) return;
        setSeriesRows(response.rows ?? []);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setSeriesRows([]);
          setSeriesError("Failed to load series");
        }
      } finally {
        if (!cancelled) {
          setSeriesLoading(false);
        }
      }
    }

    loadSeries();

    return () => {
      cancelled = true;
    };
  }, [filters.event, filters.season, filters.split, filters.stage, filters.team, filters.team2]);

  useEffect(() => {
    const maybeSeriesId = selectedSeriesId;
    if (!maybeSeriesId || seriesDetailCache[maybeSeriesId]) {
      return;
    }
    const seriesId: string = maybeSeriesId;

    let cancelled = false;

    async function loadDetails() {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const response = await api.seriesDetail(seriesId);
        if (cancelled) return;
        setSeriesDetailCache((prev) => ({
          ...prev,
          [seriesId]: response.series
        }));
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setDetailError("Failed to load series details");
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    loadDetails();

    return () => {
      cancelled = true;
    };
  }, [selectedSeriesId, seriesDetailCache]);

  useEffect(() => {
    if (!selectedSeriesId) return;
    if (seriesRows.some((row) => row.seriesId === selectedSeriesId)) return;
    setSelectedSeriesId(null);
    setDetailError(null);
  }, [selectedSeriesId, seriesRows]);

  useEffect(() => {
    if (!selectedSeriesId) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedSeriesId(null);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedSeriesId]);

  const context = seriesContext(selectedSeries);

  return (
    <div className="page page-no-nav series-page">
      <button className="ghost back-button" onClick={() => navigate("/")}>← Back to Dashboard</button>

      <div className="panel series-filters-card">
        <div className="panel-header">
          <div>
            <p className="panel-label">Explore</p>
            <h1>Series</h1>
          </div>
          <div className="section-note">{seriesRows.length} series</div>
        </div>

        {metaError ? <div className="error">{metaError}</div> : null}

        <div className="series-filter-row">
          <label>
            Season
            <select
              value={filters.season}
              onChange={(event) =>
                setFilters({ season: event.target.value, split: "", event: "", stage: "", team: "", team2: "" })
              }
            >
              <option value="">All Seasons</option>
              {(meta?.seasons ?? []).map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </select>
          </label>

          <label>
            Split
            <select
              value={filters.split}
              onChange={(event) =>
                setFilters({
                  season: filters.season,
                  split: event.target.value,
                  event: "",
                  stage: "",
                  team: "",
                  team2: ""
                })
              }
              disabled={!filters.season}
            >
              <option value="">All Splits</option>
              {(meta?.splits ?? []).map((split) => (
                <option key={split} value={split}>
                  {split}
                </option>
              ))}
            </select>
          </label>

          <label>
            Event
            <select
              value={filters.event}
              onChange={(event) =>
                setFilters({
                  season: filters.season,
                  split: filters.split,
                  event: event.target.value,
                  stage: "",
                  team: "",
                  team2: ""
                })
              }
              disabled={!filters.season || !filters.split}
            >
              <option value="">All Events</option>
              {(meta?.events ?? []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            Stage
            <select
              value={filters.stage}
              onChange={(event) =>
                setFilters({
                  season: filters.season,
                  split: filters.split,
                  event: filters.event,
                  stage: event.target.value,
                  team: "",
                  team2: ""
                })
              }
              disabled={!filters.season || !filters.split || !filters.event}
            >
              <option value="">All Stages</option>
              {(meta?.stages ?? []).map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>

          <label>
            Team 1
            <select
              value={filters.team}
              onChange={(event) =>
                setFilters({
                  season: filters.season,
                  split: filters.split,
                  event: filters.event,
                  stage: filters.stage,
                  team: event.target.value,
                  team2: filters.team2 === event.target.value ? "" : filters.team2
                })
              }
            >
              <option value="">Any Team</option>
              {teamOptions.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>

          <label>
            Team 2
            <select
              value={filters.team2}
              onChange={(event) =>
                setFilters({
                  season: filters.season,
                  split: filters.split,
                  event: filters.event,
                  stage: filters.stage,
                  team: filters.team,
                  team2: event.target.value
                })
              }
              disabled={!filters.team}
            >
              <option value="">Any Opponent</option>
              {team2Options.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="section-divider" />

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-label">Browse</p>
            <h2>All Filtered Series</h2>
          </div>
          <div className="section-note">Click a row for game-by-game results</div>
        </div>

        {seriesLoading ? <p className="empty">Loading series...</p> : null}
        {seriesError ? <div className="error">{seriesError}</div> : null}
        {!seriesLoading && !seriesError && seriesRows.length === 0 ? (
          <p className="empty">No series found for these filters.</p>
        ) : null}

        {!seriesLoading && !seriesError && seriesRows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Series</th>
                  <th>Team A</th>
                  <th>Score</th>
                  <th>Team B</th>
                  <th>Games</th>
                </tr>
              </thead>
              <tbody>
                {seriesRows.map((row) => {
                  const rowContext = seriesContext(row);
                  const titlePrefix = [row.season, row.split].filter(Boolean).join(" · ");
                  const eventHref = row.event ? buildEventPath(row.event, { season: row.season, split: row.split }) : null;
                  return (
                    <tr
                      key={row.seriesId}
                      className="series-row"
                      onClick={() => {
                        setSelectedSeriesId(row.seriesId);
                        setDetailError(null);
                      }}
                    >
                      <td>{formatDate(row.date)}</td>
                      <td>
                        <div className="cell-title">
                          <strong>
                            {titlePrefix ? <>{titlePrefix} · </> : null}
                            {eventHref && row.event ? (
                              <Link
                                className="inline-link"
                                to={eventHref}
                                onClick={(event) => event.stopPropagation()}
                              >
                                {row.event}
                              </Link>
                            ) : (
                              row.event ?? rowContext.title
                            )}
                          </strong>
                          <span>{rowContext.subtitle || "—"}</span>
                        </div>
                      </td>
                      <td><TeamNameWithLogo team={row.teamA} /></td>
                      <td>
                        <span className={scoreClass(row.teamAWins, row.teamBWins)}>
                          {row.teamAWins}-{row.teamBWins}
                        </span>
                      </td>
                      <td><TeamNameWithLogo team={row.teamB} /></td>
                      <td>{row.gamesRecorded}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {selectedSeriesId ? (
        <div
          className="series-modal-backdrop"
          onClick={() => {
            setSelectedSeriesId(null);
            setDetailError(null);
          }}
        >
          <div className="series-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <div>
                <p className="panel-label">Series Detail</p>
                <h3>
                  <TeamNameWithLogo team={selectedSeries?.teamA ?? "Team A"} /> vs{" "}
                  <TeamNameWithLogo team={selectedSeries?.teamB ?? "Team B"} />
                </h3>
                <div className="section-note">
                  {[selectedSeries?.season, selectedSeries?.split].filter(Boolean).join(" · ")}
                  {selectedSeries?.event ? (
                    <>
                      {[selectedSeries?.season, selectedSeries?.split].filter(Boolean).length ? " · " : ""}
                      <Link
                        className="inline-link"
                        to={buildEventPath(selectedSeries.event, {
                          season: selectedSeries.season,
                          split: selectedSeries.split
                        })}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {selectedSeries.event}
                      </Link>
                    </>
                  ) : null}
                </div>
                {context.subtitle ? <div className="series-subline">{context.subtitle}</div> : null}
              </div>
              <button
                className="ghost"
                onClick={() => {
                  setSelectedSeriesId(null);
                  setDetailError(null);
                }}
              >
                Close
              </button>
            </div>

            <div className="series-modal-score">
              <span className={scoreClass(selectedSeries?.teamAWins ?? 0, selectedSeries?.teamBWins ?? 0)}>
                <TeamNameWithLogo team={selectedSeries?.teamA ?? "Team A"} />
              </span>
              <strong>{selectedSeries ? `${selectedSeries.teamAWins}-${selectedSeries.teamBWins}` : "—"}</strong>
              <span className={scoreClass(selectedSeries?.teamBWins ?? 0, selectedSeries?.teamAWins ?? 0)}>
                <TeamNameWithLogo team={selectedSeries?.teamB ?? "Team B"} />
              </span>
            </div>

            {detailLoading && !selectedSeriesDetail ? <p className="empty">Loading game details...</p> : null}
            {detailError ? <div className="error">{detailError}</div> : null}

            {selectedSeriesDetail ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Game</th>
                      <th>Match ID</th>
                      <th>Result</th>
                      <th>Winner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSeriesDetail.games.map((game) => {
                      const hasGoals = game.teamAGoals !== null && game.teamBGoals !== null;
                      const result = hasGoals
                        ? `${selectedSeriesDetail.teamA ?? "Team A"} ${game.teamAGoals} - ${game.teamBGoals} ${selectedSeriesDetail.teamB ?? "Team B"}`
                        : "—";
                      const winner = game.winnerTeam ?? "Unknown";
                      const winnerCls =
                        game.winnerTeam === selectedSeriesDetail.teamA
                          ? "score-win"
                          : game.winnerTeam === selectedSeriesDetail.teamB
                            ? "score-loss"
                            : "";

                      return (
                        <tr key={`${selectedSeriesDetail.seriesId}-game-${game.gameNumber}`}>
                          <td>Game {game.gameNumber}</td>
                          <td className="series-match-id">{game.matchId ?? "—"}</td>
                          <td>{result}</td>
                          <td>
                            <span className={winnerCls}>
                              <TeamNameWithLogo team={winner} />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
