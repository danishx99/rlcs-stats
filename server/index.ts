import { createServer } from "node:http";
import { PORT } from "./src/config";
import {
  getRequestUrl,
  handleOptions,
  json,
  methodNotAllowed,
  notFound
} from "./src/utils/http";
import { handleCompare, handleCompareHistory } from "./src/routes/compare";
import { handleFeatured } from "./src/routes/featured";
import { ensureFeedbackSchema, handleFeedbackList, handleFeedbackSubmit, handleFeedbackUpdate } from "./src/routes/feedback";
import { handleImage } from "./src/routes/image";
import { handleInsights } from "./src/routes/insights";
import { handleMeta, handleMetaColumns } from "./src/routes/meta";
import { handlePlayers, handlePlayerProfile, handlePlayerResults, handlePlayerSeason } from "./src/routes/players";
import { handleRosterProfile, handleRosterResults, handleRosterSeason } from "./src/routes/rosters";
import { handleSearch } from "./src/routes/search";
import { handleSeriesDetail, handleSeriesList, handleSeriesMeta } from "./src/routes/series";
import { handleStandings } from "./src/routes/standings";
import { handleStatsTop } from "./src/routes/stats";
import { handleEventDetail } from "./src/routes/events";
import { createRouter } from "./src/router";

const router = createRouter([
  {
    method: "GET",
    pattern: "/api/health",
    handler: ({ res }) => {
      json(res, 200, { ok: true, time: new Date().toISOString() });
    }
  },
  { method: "GET", pattern: "/api/image", handler: ({ req, res, url }) => handleImage(req, res, url) },
  { method: "GET", pattern: "/api/meta/columns", handler: ({ req, res }) => handleMetaColumns(req, res) },
  { method: "GET", pattern: "/api/meta", handler: ({ req, res, url }) => handleMeta(req, res, url) },
  { method: "GET", pattern: "/api/series/meta", handler: ({ req, res, url }) => handleSeriesMeta(req, res, url) },
  { method: "GET", pattern: "/api/series", handler: ({ req, res, url }) => handleSeriesList(req, res, url) },
  { method: "GET", pattern: "/api/series/:seriesId", handler: ({ req, res, params }) => handleSeriesDetail(req, res, params.seriesId) },
  { method: "GET", pattern: "/api/search", handler: ({ req, res, url }) => handleSearch(req, res, url) },
  { method: "GET", pattern: "/api/players", handler: ({ req, res, url }) => handlePlayers(req, res, url) },
  { method: "GET", pattern: "/api/players/:playerId", handler: ({ req, res, url, params }) => handlePlayerProfile(req, res, url, params.playerId) },
  { method: "GET", pattern: "/api/players/:playerId/season", handler: ({ req, res, url, params }) => handlePlayerSeason(req, res, url, params.playerId) },
  { method: "GET", pattern: "/api/players/:playerId/results", handler: ({ req, res, url, params }) => handlePlayerResults(req, res, url, params.playerId) },
  { method: "GET", pattern: "/api/rosters/:rosterId", handler: ({ req, res, url, params }) => handleRosterProfile(req, res, url, params.rosterId) },
  { method: "GET", pattern: "/api/rosters/:rosterId/season", handler: ({ req, res, url, params }) => handleRosterSeason(req, res, url, params.rosterId) },
  { method: "GET", pattern: "/api/rosters/:rosterId/results", handler: ({ req, res, url, params }) => handleRosterResults(req, res, url, params.rosterId) },
  { method: "GET", pattern: "/api/compare/history", handler: ({ req, res, url }) => handleCompareHistory(req, res, url) },
  { method: "GET", pattern: "/api/compare", handler: ({ req, res, url }) => handleCompare(req, res, url) },
  { method: "GET", pattern: "/api/stats/top", handler: ({ req, res, url }) => handleStatsTop(req, res, url) },
  { method: "GET", pattern: "/api/featured", handler: ({ req, res, url }) => handleFeatured(req, res, url) },
  { method: "GET", pattern: "/api/standings", handler: ({ req, res, url }) => handleStandings(req, res, url) },
  { method: "GET", pattern: "/api/insights", handler: ({ req, res, url }) => handleInsights(req, res, url) },
  { method: "GET", pattern: "/api/events/:eventName", handler: ({ req, res, url, params }) => handleEventDetail(req, res, params.eventName, url) },
  { method: "POST", pattern: "/api/feedback", handler: ({ req, res }) => handleFeedbackSubmit(req, res) },
  { method: "GET", pattern: "/api/feedback", handler: ({ req, res, url }) => handleFeedbackList(req, res, url) },
  { method: "PATCH", pattern: "/api/feedback/:feedbackId", handler: ({ req, res, params }) => handleFeedbackUpdate(req, res, params.feedbackId ?? null) }
]);

const server = createServer(async (req, res) => {
  const url = getRequestUrl(req);
  if (!url) {
    json(res, 400, { error: "Bad request" });
    return;
  }

  if (req.method === "OPTIONS") {
    handleOptions(res);
    return;
  }

  const handled = await router.route(req, res, url);
  if (handled) return;

  if (url.pathname.startsWith("/api/") && router.hasPath(url.pathname)) {
    methodNotAllowed(res);
    return;
  }

  notFound(res);
});

server.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

void ensureFeedbackSchema().catch((error) => {
  console.warn("Feedback schema init failed; feedback endpoint may be unavailable until schema is created:", error);
});
