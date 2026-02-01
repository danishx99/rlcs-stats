import type { MetaResponse, SearchResult } from "../types/api";
import type { Filters } from "../types/ui";
import type { SearchSection } from "../types/ui";
import SearchPanel from "./SearchPanel";

type TopNavProps = {
  meta: MetaResponse | null;
  metaError: string | null;
  filters: Filters;
  onFiltersChange: (next: Filters) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchSections: SearchSection[];
  onView: (item: SearchResult) => void;
  onCompare: (item: SearchResult) => void;
  onTopStat: (item: SearchResult) => void;
};

export default function TopNav({
  meta,
  metaError,
  filters,
  onFiltersChange,
  searchQuery,
  onSearchChange,
  searchSections,
  onView,
  onCompare,
  onTopStat
}: TopNavProps) {
  const seasons = meta?.seasons ?? [];
  const splits = meta?.splits ?? [];
  const events = meta?.events ?? [];

  return (
    <div className="top-nav">
      <div className="top-nav-content">
        <SearchPanel
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          searchSections={searchSections}
          onView={onView}
          onCompare={onCompare}
          onTopStat={onTopStat}
        />
        <div className="top-nav-filters">
          {metaError ? <div className="filters-error">{metaError}</div> : null}
          <label>
            Season
            <select
              value={filters.season}
              onChange={(event) =>
                onFiltersChange({
                  season: event.target.value,
                  split: "",
                  event: ""
                })
              }
            >
              <option value="">All</option>
              {seasons.map((season) => (
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
                onFiltersChange({
                  season: filters.season,
                  split: event.target.value,
                  event: ""
                })
              }
              disabled={!filters.season}
            >
              <option value="">All</option>
              {splits.map((split) => (
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
                onFiltersChange({
                  season: filters.season,
                  split: filters.split,
                  event: event.target.value
                })
              }
              disabled={!filters.season || !filters.split}
            >
              <option value="">All</option>
              {events.map((event) => (
                <option key={event} value={event}>
                  {event}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
