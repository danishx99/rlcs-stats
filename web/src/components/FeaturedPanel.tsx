import { useNavigate } from "react-router-dom";
import type { FeaturedResponse } from "../types/api";
import { formatStat } from "../utils/format";
import { proxyImageUrl } from "../utils/normalize";

type FeaturedPanelProps = {
  data: FeaturedResponse;
};

export default function FeaturedPanel({ data }: FeaturedPanelProps) {
  const navigate = useNavigate();
  const cards = data.rows.slice(0, 6);

  return (
    <div className="featured-cards">
      {cards.map((row, index) => {
        const imgSrc = proxyImageUrl(row.photoUrl);
        return (
          <div
            key={row.id}
            className="featured-card"
            style={{ animationDelay: `${index * 60}ms` }}
            onClick={() => navigate(`/players/${row.id}`)}
          >
            <div className="featured-card-photo">
              {imgSrc ? (
                <img src={imgSrc} alt={row.label} loading="lazy" />
              ) : (
                <span className="card-avatar">{row.label.charAt(0)}</span>
              )}
            </div>
            <div className="featured-card-info">
              <strong>{row.label}</strong>
              <span className="card-team">{row.teams.join(" / ") || "—"}</span>
              <span className="card-value">
                {formatStat(row.value, data.metric.format, data.mode)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
