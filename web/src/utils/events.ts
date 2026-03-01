export function isInternationalEvent(eventName: string, internationalEvents: string[] = []) {
  const normalized = eventName.trim().toLowerCase();
  return internationalEvents.some((event) => event.trim().toLowerCase() === normalized);
}

export function sortEventsLanLast(events: string[], internationalEvents: string[] = []) {
  const nonLan: string[] = [];
  const lan: string[] = [];

  for (const eventName of events) {
    if (isInternationalEvent(eventName, internationalEvents)) {
      lan.push(eventName);
    } else {
      nonLan.push(eventName);
    }
  }

  return [...nonLan, ...lan];
}
