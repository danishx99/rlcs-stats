import SearchBar from "./SearchBar";
import SearchResults from "./SearchResults";
import type { SearchResult } from "../types/api";
import type { SearchSection } from "../types/ui";

const SEARCH_PLACEHOLDER = "Search for a player, roster or stat";

type SearchPanelProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchSections: SearchSection[];
  onView: (item: SearchResult) => void;
  onCompare: (item: SearchResult) => void;
  onTopStat: (item: SearchResult) => void;
};

export default function SearchPanel({
  searchQuery,
  onSearchChange,
  searchSections,
  onView,
  onCompare,
  onTopStat
}: SearchPanelProps) {
  const visibleSearchSections = searchSections.filter((section) => section.results.length > 0);
  const hasSearchResults = visibleSearchSections.length > 0;
  const trimmedQuery = searchQuery.trim();

  return (
    <div className="panel search-panel topbar-search">
      <div className="search-input-wrapper">
        <label>
          Search for a player, roster or stat
          <SearchBar value={searchQuery} onChange={onSearchChange} placeholder="" />
        </label>
        {trimmedQuery && (
          <div className="search-results-dropdown">
            {!hasSearchResults ? (
              <p className="empty">No matches yet. Try a new query.</p>
            ) : (
              <SearchResults
                sections={visibleSearchSections}
                onView={onView}
                onCompare={onCompare}
                onTopStat={onTopStat}
                renderWrapper={false}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
