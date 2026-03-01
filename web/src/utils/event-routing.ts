export function buildEventPath(eventId: string) {
  return `/events/${encodeURIComponent(eventId)}`;
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
