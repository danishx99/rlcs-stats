import { type IncomingMessage, type ServerResponse } from "node:http";

const CORS_ALLOW_METHODS = "GET, POST, PATCH, OPTIONS";
const CORS_ALLOW_HEADERS = "Content-Type, ngrok-skip-browser-warning";

export function json(res: ServerResponse, status: number, payload: unknown) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": CORS_ALLOW_METHODS,
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS
  });
  res.end(body);
}

export function methodNotAllowed(res: ServerResponse) {
  json(res, 405, { error: "Method not allowed" });
}

export function badRequest(res: ServerResponse, message: string) {
  json(res, 400, { error: message });
}

export function notFound(res: ServerResponse) {
  json(res, 404, { error: "Not found" });
}

export function handleOptions(res: ServerResponse) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": CORS_ALLOW_METHODS,
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS
  });
  res.end();
}

export function getRequestUrl(req: IncomingMessage) {
  if (!req.url || !req.headers.host) {
    return null;
  }
  return new URL(req.url, `http://${req.headers.host}`);
}

export async function readJsonBody(req: IncomingMessage, maxBytes = 32 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      throw new Error("Payload too large");
    }
    chunks.push(buffer);
  }

  if (totalBytes === 0) {
    return null;
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body");
  }
}
