import { createServer } from "node:http";
import { PORT } from "./src/config";
import {
  badRequest,
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
import { handleRosterProfile, handleRosterSeason } from "./src/routes/rosters";
import { handleSearch } from "./src/routes/search";
import { handleSeriesDetail, handleSeriesList, handleSeriesMeta } from "./src/routes/series";
import { handleStandings } from "./src/routes/standings";
import { handleStatsTop } from "./src/routes/stats";
import { handleEventDetail } from "./src/routes/events";

const server = createServer(async (req, res) => {
  const url = getRequestUrl(req);
  if (!url) {
    badRequest(res, "Bad request");
    return;
  }

  if (req.method === "OPTIONS") {
    handleOptions(res);
    return;
  }

  if (url.pathname === "/api/feedback") {
    if (req.method === "POST") {
      await handleFeedbackSubmit(req, res);
      return;
    }

    if (req.method === "GET") {
      await handleFeedbackList(req, res, url);
      return;
    }

    methodNotAllowed(res);
    return;
  }

  if (url.pathname.startsWith("/api/feedback/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const feedbackId = parts[2] ?? null;

    if (req.method === "PATCH") {
      await handleFeedbackUpdate(req, res, feedbackId);
      return;
    }

    methodNotAllowed(res);
    return;
  }

  if (req.method !== "GET") {
    methodNotAllowed(res);
    return;
  }

  if (url.pathname === "/api/health") {
    json(res, 200, { ok: true, time: new Date().toISOString() });
    return;
  }

  if (url.pathname === "/api/image") {
    await handleImage(req, res, url);
    return;
  }

  if (url.pathname === "/api/meta/columns") {
    await handleMetaColumns(req, res);
    return;
  }

  if (url.pathname === "/api/meta") {
    await handleMeta(req, res, url);
    return;
  }

  if (url.pathname === "/api/series/meta") {
    await handleSeriesMeta(req, res, url);
    return;
  }

  if (url.pathname === "/api/series") {
    await handleSeriesList(req, res, url);
    return;
  }

  if (url.pathname.startsWith("/api/series/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const seriesId = parts[2];
    if (!seriesId) {
      badRequest(res, "Series id is required");
      return;
    }

    await handleSeriesDetail(req, res, seriesId);
    return;
  }

  if (url.pathname === "/api/search") {
    await handleSearch(req, res, url);
    return;
  }

  if (url.pathname === "/api/players") {
    await handlePlayers(req, res, url);
    return;
  }

  if (url.pathname.startsWith("/api/players/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const playerId = parts[2];
    if (!playerId) {
      badRequest(res, "Player id is required");
      return;
    }

    if (parts[3] === "season") {
      await handlePlayerSeason(req, res, url, playerId);
      return;
    }

    if (parts[3] === "results") {
      await handlePlayerResults(req, res, url, playerId);
      return;
    }

    await handlePlayerProfile(req, res, url, playerId);
    return;
  }

  if (url.pathname.startsWith("/api/rosters/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const rosterId = parts[2];
    if (!rosterId) {
      badRequest(res, "Roster id is required");
      return;
    }

    if (parts[3] === "season") {
      await handleRosterSeason(req, res, url, rosterId);
      return;
    }

    await handleRosterProfile(req, res, url, rosterId);
    return;
  }

  if (url.pathname === "/api/compare/history") {
    await handleCompareHistory(req, res, url);
    return;
  }

  if (url.pathname === "/api/compare") {
    await handleCompare(req, res, url);
    return;
  }

  if (url.pathname === "/api/stats/top") {
    await handleStatsTop(req, res, url);
    return;
  }

  if (url.pathname === "/api/featured") {
    await handleFeatured(req, res, url);
    return;
  }

  if (url.pathname === "/api/standings") {
    await handleStandings(req, res, url);
    return;
  }

  if (url.pathname === "/api/insights") {
    await handleInsights(req, res, url);
    return;
  }

  if (url.pathname.startsWith("/api/events/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const eventName = parts[2];
    if (!eventName) {
      badRequest(res, "Event name is required");
      return;
    }

    await handleEventDetail(req, res, eventName, url);
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
