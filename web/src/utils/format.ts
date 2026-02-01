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
    return `${percentFormatter.format(value)}%`;
  }
  if (format === "float") {
    return decimalFormatter.format(value);
  }
  return numberFormatter.format(value);
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
  return formatValue(value, format);
}
