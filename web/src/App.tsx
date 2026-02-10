import { useMemo, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useMeta } from "./hooks/useMeta";
import { useSearch } from "./hooks/useSearch";
import type { SearchResponse, SearchResult } from "./types/api";
import type { Filters, SearchSection } from "./types/ui";
import TopNav from "./components/TopNav";
import HomePage from "./pages/HomePage";
import ComparePage from "./pages/ComparePage";
import PlayerPage from "./pages/PlayerPage";
import RosterPage from "./pages/RosterPage";
import SeriesPage from "./pages/SeriesPage";
import StatPage from "./pages/StatPage";

export default function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse>({
    players: [],
    rosters: [],
    stats: []
  });
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ season: "", split: "", event: "" });
  const [compareMode, setCompareMode] = useState<"players" | "rosters">("players");
  const [compareSelection, setCompareSelection] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === "/";
  const hideTopNav =
    isHome ||
    location.pathname.startsWith("/players/") ||
    location.pathname.startsWith("/rosters/") ||
    location.pathname.startsWith("/compare") ||
    location.pathname.startsWith("/series");

  const { meta, metaError } = useMeta(filters);

  useSearch(searchQuery, setSearchResults, setSearchLoading, setSearchError);

  const searchSections: SearchSection[] = useMemo(
    () => [
      { key: "players", label: "Players", results: searchResults.players },
      { key: "rosters", label: "Rosters", results: searchResults.rosters },
      { key: "stats", label: "Stats", results: searchResults.stats }
    ],
    [searchResults.players, searchResults.rosters, searchResults.stats]
  );

  const addCompareSelection = (item: SearchResult) => {
    if (item.type === "stat") return;
    setCompareMode(item.type === "player" ? "players" : "rosters");
    setCompareSelection((prev) => {
      if (prev.some((existing) => existing.id === item.id)) return prev;
      return [...prev, item];
    });
  };

  const removeCompareSelection = (id: string) => {
    setCompareSelection((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCompareSelection = () => {
    setCompareSelection([]);
  };

  const clearSearch = () => setSearchQuery("");

  const handleView = (item: SearchResult) => {
    clearSearch();
    if (item.type === "player") {
      navigate(`/players/${item.id}`);
      return;
    }
    if (item.type === "roster") {
      navigate(`/rosters/${item.id}`);
      return;
    }
  };

  const handleCompare = (item: SearchResult) => {
    addCompareSelection(item);
    clearSearch();
    navigate("/compare");
  };

  const handleTopStat = (item: SearchResult) => {
    clearSearch();
    if (item.type !== "stat") return;
    navigate(`/stats/${item.id}`);
  };

  return (
    <div className="app-shell">
      {!hideTopNav && (
        <TopNav
          meta={meta}
          metaError={metaError}
          filters={filters}
          onFiltersChange={setFilters}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchSections={searchSections}
          onView={handleView}
          onCompare={handleCompare}
          onTopStat={handleTopStat}
        />
      )}
      <div className="app-content">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                filters={filters}
                latestSeason={meta?.seasons?.length ? meta.seasons[meta.seasons.length - 1] : null}
                featuredOptions={meta?.featuredOptions ?? []}
              />
            }
          />
          <Route
            path="/compare"
            element={
              <ComparePage
                filters={filters}
                onFiltersChange={setFilters}
                meta={meta}
                compareMode={compareMode}
                compareSelection={compareSelection}
                onAddCompare={addCompareSelection}
                onRemoveCompare={removeCompareSelection}
                onClearCompare={clearCompareSelection}
                statOptions={meta?.statOptions ?? []}
              />
            }
          />
          <Route path="/players/:uniqueId" element={<PlayerPage filters={filters} meta={meta} onFiltersChange={setFilters} />} />
          <Route path="/rosters/:rosterId" element={<RosterPage filters={filters} meta={meta} onFiltersChange={setFilters} />} />
          <Route path="/stats/:statKey" element={<StatPage filters={filters} />} />
          <Route path="/series" element={<SeriesPage />} />
        </Routes>
      </div>
    </div>
  );
}
