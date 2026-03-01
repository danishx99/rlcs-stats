import { Route, Routes } from "react-router-dom";
import { useMeta } from "./hooks/useMeta";
import HomePage from "./pages/HomePage";
import ComparePage from "./pages/ComparePage";
import PlayerPage from "./pages/PlayerPage";
import RosterPage from "./pages/RosterPage";
import SeriesPage from "./pages/SeriesPage";
import StatPage from "./pages/StatPage";
import EventPage from "./pages/EventPage";
import FeedbackPage from "./pages/FeedbackPage";
import FeedbackWidget from "./components/FeedbackWidget";

export default function App() {
  const { meta: baseMeta } = useMeta({
    mode: "3s",
    scope: "regional",
    tier: "none",
    season: "",
    split: "",
    event: ""
  });
  const latestSeason = baseMeta?.seasons?.length
    ? [...baseMeta.seasons].sort((a, b) => {
        const yearA = Number.parseInt(a, 10);
        const yearB = Number.parseInt(b, 10);
        if (Number.isFinite(yearA) && Number.isFinite(yearB)) return yearA - yearB;
        return a.localeCompare(b);
      })[baseMeta.seasons.length - 1]
    : null;

  return (
    <div className="app-shell">
      <div className="app-content">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                latestSeason={latestSeason}
                featuredOptions={baseMeta?.featuredOptions ?? []}
              />
            }
          />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/players/:uniqueId" element={<PlayerPage />} />
          <Route path="/rosters/:rosterId" element={<RosterPage />} />
          <Route path="/stats/:statKey" element={<StatPage />} />
          <Route path="/events/:eventId" element={<EventPage />} />
          <Route path="/series" element={<SeriesPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
        </Routes>
      </div>
      <FeedbackWidget />
    </div>
  );
}
