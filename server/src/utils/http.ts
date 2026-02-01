import { type IncomingMessage, type ServerResponse } from "node:http";

export function json(res: ServerResponse, status: number, payload: unknown) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
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
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  });
  res.end();
}

export function getRequestUrl(req: IncomingMessage) {
  if (!req.url || !req.headers.host) {
    return null;
  }
  return new URL(req.url, `http://${req.headers.host}`);
}
