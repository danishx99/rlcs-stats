import { type IncomingMessage, type ServerResponse } from "node:http";

type RouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Record<string, string>;
};

type RouteHandler = (context: RouteContext) => Promise<void> | void;

type RouteDefinition = {
  method: string;
  pattern: string;
  handler: RouteHandler;
};

type CompiledRoute = RouteDefinition & {
  regex: RegExp;
  keys: string[];
};

function compilePattern(pattern: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const segments = pattern.split("/").filter(Boolean);
  const regexSegments = segments.map((segment) => {
    if (segment.startsWith(":")) {
      keys.push(segment.slice(1));
      return "([^/]+)";
    }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });

  return {
    regex: new RegExp(`^/${regexSegments.join("/")}$`),
    keys
  };
}

function compileRoutes(definitions: RouteDefinition[]): CompiledRoute[] {
  return definitions.map((definition) => ({
    ...definition,
    ...compilePattern(definition.pattern)
  }));
}

function findMatchingRoute(method: string, pathname: string, routes: CompiledRoute[]) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = pathname.match(route.regex);
    if (!match) continue;

    const params: Record<string, string> = {};
    route.keys.forEach((key, index) => {
      params[key] = match[index + 1] ?? "";
    });

    return { route, params };
  }

  return null;
}

export function createRouter(definitions: RouteDefinition[]) {
  const routes = compileRoutes(definitions);

  async function route(req: IncomingMessage, res: ServerResponse, url: URL) {
    const method = req.method ?? "GET";
    const match = findMatchingRoute(method, url.pathname, routes);
    if (!match) return false;

    await match.route.handler({ req, res, url, params: match.params });
    return true;
  }

  function hasPath(pathname: string) {
    return routes.some((route) => pathname.match(route.regex));
  }

  return { route, hasPath };
}

export type { RouteDefinition, RouteContext, RouteHandler };
