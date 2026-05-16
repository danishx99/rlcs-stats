import type { StatOption } from "../types/api";

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

export function formatValue(value: number | null | undefined, format?: StatOption["format"]) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  if (format === "pct") {
    return `${percentFormatter.format(value).replace(/,/g, " ")}%`;
  }
  if (format === "float") {
    return decimalFormatter.format(value).replace(/,/g, " ");
  }
  return numberFormatter.format(value).replace(/,/g, " ");
}

export function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function placementLabel(start: number, end: number) {
  if (!start || !end) return "";
  if (start === end) return ordinal(start);
  return `${ordinal(start)}-${ordinal(end)}`;
}

/**
 * Format a placement string into an ordinal label.
 *
 * Resolution order:
 *  1. If both `placementStart` and `placementEnd` are finite positive numbers,
 *     render `placementLabel(start, end)`.
 *  2. Otherwise parse `placement` as a string:
 *     - `"Top N-M"` → `placementLabel(N, M)`
 *     - `"Top N"`   → half-range `(floor(N/2)+1)-N` ordinal (Top 1 → "1st", Top 2 → "2nd")
 *     - anything else → original string
 *  3. If no placement available, return `"—"`.
 */
export function formatPlacement(
  placement: string | null,
  placementStart?: number | null,
  placementEnd?: number | null
) {
  const hasRange =
    Number.isFinite(placementStart) &&
    Number.isFinite(placementEnd) &&
    Number(placementStart) > 0 &&
    Number(placementEnd) > 0;
  if (hasRange) {
    return placementLabel(Number(placementStart), Number(placementEnd));
  }

  if (!placement) return "—";

  const ranged = placement.match(/^Top\s+(\d+)-(\d+)$/i);
  if (ranged) {
    const start = Number(ranged[1]);
    const end = Number(ranged[2]);
    if (Number.isFinite(start) && start > 0 && Number.isFinite(end) && end > 0) {
      return placementLabel(start, end);
    }
    return placement;
  }

  const single = placement.match(/^Top\s+(\d+)$/i);
  if (!single) return placement;
  const top = Number(single[1]);
  if (!Number.isFinite(top) || top <= 0) return placement;
  if (top === 1) return "1st";
  if (top === 2) return "2nd";
  const start = Math.floor(top / 2) + 1;
  return `${ordinal(start)}-${ordinal(top)}`;
}

export function formatStat(
  value: number | null | undefined,
  format: StatOption["format"] | undefined,
  mode: "avg" | "total"
) {
  if (format === "pct") {
    return formatValue(value, "pct");
  }
  if (format === "int") {
    return formatValue(value, "int");
  }
  if (mode === "avg") {
    return formatValue(value, "float");
  }
  return formatValue(value, "int");
}
