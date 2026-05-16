import type { StatOption } from "../types/api";
import { ordinal } from "../utils/format";

export type SpotlightTileProps = {
  label: string;
  format: StatOption["format"];
  total: number | null;
  avg: number | null;
  rank: number | null;
  removable?: boolean;
  onRemove?: () => void;
};

export default function SpotlightTile({
  label,
  format,
  total,
  avg,
  rank,
  removable,
  onRemove
}: SpotlightTileProps) {
  const fmt = format ?? "int";

  let headline: string;
  let secondary: string | null = null;

  if (fmt === "int") {
    headline = Math.round(total ?? 0).toLocaleString("en-US");
    const totalNum = total ?? 0;
    const avgNum = avg ?? 0;
    if (Math.abs(totalNum - avgNum) >= 0.05) {
      secondary = `${avgNum.toFixed(1)} avg`;
    }
  } else if (fmt === "pct") {
    headline = `${(avg ?? 0).toFixed(1)}%`;
  } else {
    headline = (avg ?? 0).toFixed(1);
  }

  return (
    <div className="career-spotlight-stat">
      {removable && onRemove ? (
        <button
          type="button"
          className="career-spotlight-stat-remove"
          aria-label={`Remove ${label} from spotlight`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      ) : null}
      <span>{label}</span>
      <strong>{headline}</strong>
      {secondary ? <small>{secondary}</small> : null}
      {rank != null ? (
        <small className="career-spotlight-rank">{ordinal(rank)} overall</small>
      ) : null}
    </div>
  );
}
