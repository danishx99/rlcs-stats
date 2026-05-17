import { createHash } from "node:crypto";
import type { Context } from "hono";
import { pool } from "../db";
import { getClientIp } from "../utils/client-ip";
import { errorJson } from "../utils/responses";

type FeedbackType = "bug" | "idea" | "question";

const FEEDBACK_TYPES = new Set<FeedbackType>(["bug", "idea", "question"]);

const CREATE_FEEDBACK_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS feedback_submissions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
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

const ADD_FEEDBACK_RESOLVED_AT_COLUMN_SQL = `
ALTER TABLE feedback_submissions
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
`;

const CREATE_FEEDBACK_RESOLVED_AT_CREATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_resolved_at_created_at
ON feedback_submissions (resolved_at, created_at DESC);
`;

let feedbackSchemaReady = false;
let feedbackSchemaPromise: Promise<void> | null = null;

function getObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getString(value: unknown, maxLength: number): string | null {
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

function hashValue(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function parseLimit(rawLimit: string | null): number {
  if (!rawLimit) return 500;
  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 500;
  return Math.min(parsed, 2000);
}

function parseFeedbackId(rawId: string | null): number | null {
  if (!rawId) return null;
  const trimmed = rawId.trim();
  if (!/^[0-9]+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseResolvedFilter(rawValue: string | null): boolean | null {
  if (!rawValue) return null;
  const normalized = rawValue.trim().toLowerCase();
  if (!normalized || normalized === "all") return null;
  if (normalized === "resolved" || normalized === "true" || normalized === "1") return true;
  if (normalized === "unresolved" || normalized === "false" || normalized === "0") return false;
  return null;
}

export async function ensureFeedbackSchema(): Promise<void> {
  if (feedbackSchemaReady) return;
  if (feedbackSchemaPromise) {
    await feedbackSchemaPromise;
    return;
  }

  feedbackSchemaPromise = (async () => {
    await pool.query(CREATE_FEEDBACK_TABLE_SQL);
    await pool.query(ADD_FEEDBACK_RESOLVED_AT_COLUMN_SQL);
    await pool.query(CREATE_FEEDBACK_CREATED_AT_INDEX_SQL);
    await pool.query(CREATE_FEEDBACK_TYPE_CREATED_AT_INDEX_SQL);
    await pool.query(CREATE_FEEDBACK_RESOLVED_AT_CREATED_AT_INDEX_SQL);
    feedbackSchemaReady = true;
  })();

  try {
    await feedbackSchemaPromise;
  } finally {
    feedbackSchemaPromise = null;
  }
}

export async function handleFeedbackSubmit(c: Context) {
  try {
    await ensureFeedbackSchema();
  } catch (error) {
    console.error(error);
    return errorJson(c, 500, "Failed to initialize feedback storage");
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return errorJson(c, 400, "Invalid JSON body");
  }

  const payload = getObject(body);
  if (!payload) {
    return errorJson(c, 400, "Request body must be a JSON object");
  }

  const feedbackType = normalizeFeedbackType(payload.type);
  if (!feedbackType) {
    return errorJson(c, 400, "type must be one of: bug, idea, question");
  }

  const message = getString(payload.message, 2000);
  if (!message || message.length < 5) {
    return errorJson(c, 400, "message must be at least 5 characters");
  }

  const page = getObject(payload.page);
  if (!page) {
    return errorJson(c, 400, "page context is required");
  }

  const pageUrl = getString(page.url, 4000);
  const pagePath = getString(page.path, 2048);
  if (!pageUrl || !pagePath) {
    return errorJson(c, 400, "page.url and page.path are required");
  }

  const pageSearch = getString(page.search, 2048);
  const pageHash = getString(page.hash, 2048);
  const pageTitle = getString(page.title, 512);

  const client = getObject(payload.client) ?? {};
  const clientContext = {
    viewportWidth: getOptionalNumber(client.viewportWidth),
    viewportHeight: getOptionalNumber(client.viewportHeight),
    screenWidth: getOptionalNumber(client.screenWidth),
    screenHeight: getOptionalNumber(client.screenHeight),
    language: getString(client.language, 64),
    timezone: getString(client.timezone, 128),
    userAgent: getString(client.userAgent, 1024),
    platform: getString(client.platform, 128),
    referrer: getString(client.referrer, 2048),
    submittedAt: getString(client.submittedAt, 64),
    sessionId: getString(client.sessionId, 128)
  };

  const clientIp = getClientIp(c);
  const serverContext = {
    receivedAt: new Date().toISOString(),
    ipHash: hashValue(clientIp ?? "unknown"),
    host: getString(c.req.header("host"), 512),
    origin: getString(c.req.header("origin"), 2048),
    method: c.req.method ?? null
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

    return c.json({ ok: true, id: Number(result.rows[0]?.id ?? 0) }, 201);
  } catch (error) {
    console.error(error);
    return errorJson(c, 500, "Failed to submit feedback");
  }
}

export async function handleFeedbackList(c: Context) {
  try {
    await ensureFeedbackSchema();
  } catch (error) {
    console.error(error);
    return errorJson(c, 500, "Failed to initialize feedback storage");
  }

  const typeRaw = c.req.query("type");
  const resolvedRaw = c.req.query("resolved");
  const limit = parseLimit(c.req.query("limit") ?? null);
  const filterType = normalizeFeedbackType(typeRaw ?? null);
  const filterResolved = parseResolvedFilter(resolvedRaw ?? null);

  if (typeRaw !== undefined && !filterType) {
    return errorJson(c, 400, "type must be one of: bug, idea, question");
  }

  if (resolvedRaw !== undefined && filterResolved === null) {
    const rawValue = (resolvedRaw ?? "").trim().toLowerCase();
    if (rawValue && rawValue !== "all") {
      return errorJson(c, 400, "resolved must be one of: resolved, unresolved, all");
    }
  }

  const whereClauses: string[] = [];
  const values: Array<string | number> = [];

  if (filterType) {
    values.push(filterType);
    whereClauses.push(`feedback_type = $${values.length}`);
  }

  if (filterResolved === true) {
    whereClauses.push("resolved_at IS NOT NULL");
  }

  if (filterResolved === false) {
    whereClauses.push("resolved_at IS NULL");
  }

  values.push(limit);
  const limitPlaceholder = `$${values.length}`;
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        created_at,
        resolved_at,
        feedback_type,
        message,
        page_url,
        page_path,
        page_search,
        page_hash,
        page_title,
        client_context,
        server_context
      FROM feedback_submissions
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ${limitPlaceholder};
      `,
      values
    );

    return c.json({
      rows: result.rows.map((row) => ({
        id: Number(row.id),
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
        resolved: Boolean(row.resolved_at),
        type: row.feedback_type,
        message: row.message,
        page: {
          url: row.page_url,
          path: row.page_path,
          search: row.page_search,
          hash: row.page_hash,
          title: row.page_title
        },
        client: row.client_context ?? null,
        server: row.server_context ?? null
      }))
    });
  } catch (error) {
    console.error(error);
    return errorJson(c, 500, "Failed to load feedback");
  }
}

export async function handleFeedbackUpdate(c: Context, feedbackIdRaw: string | null) {
  try {
    await ensureFeedbackSchema();
  } catch (error) {
    console.error(error);
    return errorJson(c, 500, "Failed to initialize feedback storage");
  }

  const feedbackId = parseFeedbackId(feedbackIdRaw);
  if (!feedbackId) {
    return errorJson(c, 400, "Invalid feedback id");
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return errorJson(c, 400, "Invalid JSON body");
  }

  const payload = getObject(body);
  if (!payload) {
    return errorJson(c, 400, "Request body must be a JSON object");
  }

  if (typeof payload.resolved !== "boolean") {
    return errorJson(c, 400, "resolved must be a boolean");
  }

  try {
    const result = await pool.query(
      `
      UPDATE feedback_submissions
      SET resolved_at = CASE WHEN $2::boolean THEN COALESCE(resolved_at, now()) ELSE NULL END
      WHERE id = $1
      RETURNING id, resolved_at;
      `,
      [feedbackId, payload.resolved]
    );

    if (result.rowCount === 0) {
      return errorJson(c, 404, "Feedback item not found");
    }

    const row = result.rows[0];
    return c.json({
      ok: true,
      id: Number(row.id),
      resolvedAt: row.resolved_at,
      resolved: Boolean(row.resolved_at)
    });
  } catch (error) {
    console.error(error);
    return errorJson(c, 500, "Failed to update feedback");
  }
}
