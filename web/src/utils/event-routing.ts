export type EventRouteOptions = {
  season?: string | null;
  split?: string | null;
};

export function buildEventPath(eventName: string, options?: EventRouteOptions) {
  const params = new URLSearchParams();
  if (options?.season) params.set("season", options.season);
  if (options?.split) params.set("split", options.split);
  const query = params.toString();
  return `/events/${encodeURIComponent(eventName)}${query ? `?${query}` : ""}`;
}

export function parseDebutEvent(value: string | null | undefined) {
  if (!value) return null;
  const parts = value.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return null;

  return {
    season: parts[0],
    split: parts[1],
    event: parts.slice(2).join(" / ")
  };
}
