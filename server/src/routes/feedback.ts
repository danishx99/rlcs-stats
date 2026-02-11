import { createHash } from "node:crypto";
import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { badRequest, json, readJsonBody } from "../utils/http";

type FeedbackType = "bug" | "idea" | "question";

const FEEDBACK_TYPES = new Set<FeedbackType>(["bug", "idea", "question"]);

const CREATE_FEEDBACK_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS feedback_submissions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bug', 'idea', 'question')),
  message TEXT NOT NULL,
  page_url TEXT NOT NULL,
  page_path TEXT NOT NULL,
  page_search TEXT,
  page_hash TEXT,
  page_title TEXT,
  client_context JSONB NOT NULL,
  server_context JSONB NOT NULL
);
`;

const CREATE_FEEDBACK_CREATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_created_at
ON feedback_submissions (created_at DESC);
`;

const CREATE_FEEDBACK_TYPE_CREATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_type_created_at
ON feedback_submissions (feedback_type, created_at DESC);
`;

let feedbackSchemaReady = false;
let feedbackSchemaPromise: Promise<void> | null = null;

function getObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getRequiredString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
}

function getOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
}

function getOptionalNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function normalizeFeedbackType(value: unknown): FeedbackType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase() as FeedbackType;
  if (!FEEDBACK_TYPES.has(normalized)) return null;
  return normalized;
}

function getClientIp(req: IncomingMessage): string | null {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? null;
}

function hashValue(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function ensureFeedbackSchema(): Promise<void> {
  if (feedbackSchemaReady) return;
  if (feedbackSchemaPromise) {
    await feedbackSchemaPromise;
    return;
  }

  feedbackSchemaPromise = (async () => {
    await pool.query(CREATE_FEEDBACK_TABLE_SQL);
    await pool.query(CREATE_FEEDBACK_CREATED_AT_INDEX_SQL);
    await pool.query(CREATE_FEEDBACK_TYPE_CREATED_AT_INDEX_SQL);
    feedbackSchemaReady = true;
  })();

  try {
    await feedbackSchemaPromise;
  } finally {
    feedbackSchemaPromise = null;
  }
}

export async function handleFeedbackSubmit(req: IncomingMessage, res: ServerResponse) {
  try {
    await ensureFeedbackSchema();
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to initialize feedback storage" });
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON body";
    if (message === "Payload too large") {
      json(res, 413, { error: "Payload too large" });
      return;
    }
    badRequest(res, "Invalid JSON body");
    return;
  }

  const payload = getObject(body);
  if (!payload) {
    badRequest(res, "Request body must be a JSON object");
    return;
  }

  const feedbackType = normalizeFeedbackType(payload.type);
  if (!feedbackType) {
    badRequest(res, "type must be one of: bug, idea, question");
    return;
  }

  const message = getRequiredString(payload.message, 2000);
  if (!message || message.length < 5) {
    badRequest(res, "message must be at least 5 characters");
    return;
  }

  const page = getObject(payload.page);
  if (!page) {
    badRequest(res, "page context is required");
    return;
  }

  const pageUrl = getRequiredString(page.url, 4000);
  const pagePath = getRequiredString(page.path, 2048);
  if (!pageUrl || !pagePath) {
    badRequest(res, "page.url and page.path are required");
    return;
  }

  const pageSearch = getOptionalString(page.search, 2048);
  const pageHash = getOptionalString(page.hash, 2048);
  const pageTitle = getOptionalString(page.title, 512);

  const client = getObject(payload.client) ?? {};
  const clientContext = {
    viewportWidth: getOptionalNumber(client.viewportWidth),
    viewportHeight: getOptionalNumber(client.viewportHeight),
    screenWidth: getOptionalNumber(client.screenWidth),
    screenHeight: getOptionalNumber(client.screenHeight),
    language: getOptionalString(client.language, 64),
    timezone: getOptionalString(client.timezone, 128),
    userAgent: getOptionalString(client.userAgent, 1024),
    platform: getOptionalString(client.platform, 128),
    referrer: getOptionalString(client.referrer, 2048),
    submittedAt: getOptionalString(client.submittedAt, 64),
    sessionId: getOptionalString(client.sessionId, 128)
  };

  const clientIp = getClientIp(req);
  const serverContext = {
    receivedAt: new Date().toISOString(),
    ipHash: hashValue(clientIp ?? "unknown"),
    host: getOptionalString(req.headers.host, 512),
    origin: getOptionalString(req.headers.origin, 2048),
    method: req.method ?? null
  };

  try {
    const result = await pool.query(
      `
      INSERT INTO feedback_submissions (
        feedback_type,
        message,
        page_url,
        page_path,
        page_search,
        page_hash,
        page_title,
        client_context,
        server_context
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
      RETURNING id;
      `,
      [
        feedbackType,
        message,
        pageUrl,
        pagePath,
        pageSearch,
        pageHash,
        pageTitle,
        JSON.stringify(clientContext),
        JSON.stringify(serverContext)
      ]
    );

    json(res, 201, { ok: true, id: Number(result.rows[0]?.id ?? 0) });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to submit feedback" });
  }
}
