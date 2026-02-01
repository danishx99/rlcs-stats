import type { FeaturedResponse } from "../types/api";
import { formatStat, formatValue } from "../utils/format";
import { proxyImageUrl } from "../utils/normalize";

const FEATURED_LIMIT = 6;

type FeaturedPanelProps = {
  data: FeaturedResponse;
};

export default function FeaturedPanel({ data }: FeaturedPanelProps) {
  return (
    <div className="featured-grid">
      {data.rows.slice(0, FEATURED_LIMIT).map((row, index) => (
        <article key={row.id} className="featured-card">
          <div className="avatar">
            {row.photoUrl ? (
              <img
                src={proxyImageUrl(row.photoUrl) ?? undefined}
                alt={row.label}
                loading="lazy"
              />
            ) : (
              <span>{row.country ? row.country : formatValue(index + 1, "int")}</span>
            )}
          </div>
          <div>
            <h3>{row.label}</h3>
            <p>{row.teams.join(" / ")}</p>
            <strong>{formatStat(row.value, data.metric.format, data.mode)}</strong>
          </div>
        </article>
      ))}
    </div>
  );
}
