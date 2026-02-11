import { useState } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { useMeta } from "./hooks/useMeta";
import type { SearchResult } from "./types/api";
import type { Filters } from "./types/ui";
import HomePage from "./pages/HomePage";
import ComparePage from "./pages/ComparePage";
import PlayerPage from "./pages/PlayerPage";
import RosterPage from "./pages/RosterPage";
import SeriesPage from "./pages/SeriesPage";
import StatPage from "./pages/StatPage";
import EventPage from "./pages/EventPage";
import FeedbackWidget from "./components/FeedbackWidget";

export default function App() {
  const [filters, setFilters] = useState<Filters>({ season: "", split: "", event: "" });
  const [compareMode, setCompareMode] = useState<"players" | "rosters">("players");
  const [compareSelection, setCompareSelection] = useState<SearchResult[]>([]);
  const navigate = useNavigate();

  const { meta } = useMeta(filters);

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

  return (
    <div className="app-shell">
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
          <Route path="/events/:eventName" element={<EventPage />} />
          <Route path="/series" element={<SeriesPage />} />
        </Routes>
      </div>
      <FeedbackWidget />
    </div>
  );
}
