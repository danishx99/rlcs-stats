import type { FeaturedResponse } from "../types/api";
import { formatStat, formatValue } from "../utils/format";

type FeaturedPanelProps = {
  data: FeaturedResponse;
};

export default function FeaturedPanel({ data }: FeaturedPanelProps) {
  const columns = data.columns ?? [];

  return (
    <table className="featured-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Team</th>
          {columns.map((col) => (
            <th key={col.key} className="featured-extra-col">{col.label}</th>
          ))}
          <th className="featured-value-col">{data.metric.label}</th>
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, index) => (
          <tr key={row.id}>
            <td className="featured-rank">{index + 1}</td>
            <td className="featured-player">{row.label}</td>
            <td className="featured-team">{row.teams.join(" / ")}</td>
            {columns.map((col) => (
              <td key={col.key} className="featured-extra">
                {formatValue(row.extras?.[col.key], col.format)}
              </td>
            ))}
            <td className="featured-value">
              {formatStat(row.value, data.metric.format, data.mode)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
