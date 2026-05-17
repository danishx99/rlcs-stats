import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { serve } from "@hono/node-server";
import { PORT } from "./src/config";
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
import { FEEDBACK_SUBMIT_LIMIT, FEEDBACK_UPDATE_LIMIT, createRateLimiter } from "./src/middleware/rate-limit";

const app = new Hono();

const feedbackSubmitRateLimit = createRateLimiter(FEEDBACK_SUBMIT_LIMIT).middleware;
const feedbackUpdateRateLimit = createRateLimiter(FEEDBACK_UPDATE_LIMIT).middleware;

app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "ngrok-skip-browser-warning"]
}));

// 32 KB body limit on feedback writes (matches previous readJsonBody cap)
const feedbackBodyLimit = bodyLimit({
  maxSize: 32 * 1024,
  onError: (c) => c.json({ error: "Payload too large" }, 413)
});

app.get("/api/health", (c) => c.json({ ok: true, time: new Date().toISOString() }));

app.get("/api/image", (c) => handleImage(c));
app.get("/api/meta/columns", (c) => handleMetaColumns(c));
app.get("/api/meta", (c) => handleMeta(c));
app.get("/api/series/meta", (c) => handleSeriesMeta(c));
app.get("/api/series", (c) => handleSeriesList(c));
app.get("/api/series/:seriesId", (c) => handleSeriesDetail(c, c.req.param("seriesId")));
app.get("/api/search", (c) => handleSearch(c));
app.get("/api/players", (c) => handlePlayers(c));
app.get("/api/players/:playerId", (c) => handlePlayerProfile(c, c.req.param("playerId")));
app.get("/api/players/:playerId/season", (c) => handlePlayerSeason(c, c.req.param("playerId")));
app.get("/api/players/:playerId/results", (c) => handlePlayerResults(c, c.req.param("playerId")));
app.get("/api/rosters/:rosterId", (c) => handleRosterProfile(c, c.req.param("rosterId")));
app.get("/api/rosters/:rosterId/season", (c) => handleRosterSeason(c, c.req.param("rosterId")));
app.get("/api/rosters/:rosterId/results", (c) => handleRosterResults(c, c.req.param("rosterId")));
app.get("/api/compare/history", (c) => handleCompareHistory(c));
app.get("/api/compare", (c) => handleCompare(c));
app.get("/api/stats/top", (c) => handleStatsTop(c));
app.get("/api/featured", (c) => handleFeatured(c));
app.get("/api/standings", (c) => handleStandings(c));
app.get("/api/insights", (c) => handleInsights(c));
app.get("/api/events/:eventName", (c) => handleEventDetail(c, c.req.param("eventName")));
app.post("/api/feedback", feedbackSubmitRateLimit, feedbackBodyLimit, (c) => handleFeedbackSubmit(c));
app.get("/api/feedback", (c) => handleFeedbackList(c));
app.patch("/api/feedback/:feedbackId", feedbackUpdateRateLimit, feedbackBodyLimit, (c) => handleFeedbackUpdate(c, c.req.param("feedbackId") ?? null));

const apiMethodRules: Array<{ pattern: RegExp; methods: Set<string> }> = [
  { pattern: /^\/api\/health$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/image$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/meta\/columns$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/meta$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/series\/meta$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/series$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/series\/[^/]+$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/search$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/players$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/players\/[^/]+$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/players\/[^/]+\/season$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/players\/[^/]+\/results$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/rosters\/[^/]+$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/rosters\/[^/]+\/season$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/rosters\/[^/]+\/results$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/compare\/history$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/compare$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/stats\/top$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/featured$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/standings$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/insights$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/events\/[^/]+$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/feedback$/, methods: new Set(["GET", "POST"]) },
  { pattern: /^\/api\/feedback\/[^/]+$/, methods: new Set(["PATCH"]) }
];

app.notFound((c) => {
  const path = c.req.path;
  const method = c.req.method.toUpperCase();
  const matchedRule = apiMethodRules.find((rule) => rule.pattern.test(path));
  if (matchedRule && !matchedRule.methods.has(method)) {
    return c.json({ error: "Method not allowed" }, 405);
  }
  return c.json({ error: "Not found" }, 404);
});
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

try {
  await ensureFeedbackSchema();
} catch (error) {
  console.warn("Feedback schema init failed; feedback endpoint may be unavailable until schema is created:", error);
}

serve({ fetch: app.fetch, port: Number(PORT) }, (info) => {
  console.log(`API running on http://localhost:${info.port}`);
});
