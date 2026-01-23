import { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

type Insight = {
  id: string;
  title: string;
  subtitle: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

type ApiResponse = {
  generatedAt: string;
  insights: Insight[];
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2
});

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "number") {
    return numberFormatter.format(value);
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

export default function App() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/insights`);
        if (!response.ok) {
          throw new Error(`API error ${response.status}`);
        }
        const payload = (await response.json()) as ApiResponse;
        if (!ignore) {
          setData(payload);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  const insights = data?.insights ?? [];
  const selectedInsight = useMemo(() => {
    if (!insights.length) return null;
    return insights.find((insight) => insight.id === selectedId) ?? insights[0];
  }, [insights, selectedId]);

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">RLCS Stats Lens</p>
          <h1>RLCS SSA Fall Split 2021</h1>
          <div className="meta">
            <span>Stage coverage: Swiss + Playoff</span>
            <span>
              {data?.generatedAt
                ? `Generated ${new Date(data.generatedAt).toLocaleString()}`
                : "Waiting for data"}
            </span>
          </div>
        </div>
      </header>

      <section className="status">
        {loading && <p>Loading insights from the arena...</p>}
        {error && <p className="error">Unable to reach API. {error}</p>}
      </section>

      <section className="board">
        <aside className="insight-nav">
          <h2>Insights</h2>
          <div className="nav-list" role="tablist" aria-label="Insights">
            {insights.map((insight) => {
              const active = insight.id === selectedInsight?.id;
              return (
                <button
                  key={insight.id}
                  type="button"
                  className={active ? "nav-item active" : "nav-item"}
                  onClick={() => setSelectedId(insight.id)}
                  role="tab"
                  aria-selected={active}
                >
                  <span className="nav-title">{insight.title}</span>
                  <span className="nav-sub">{insight.subtitle}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <article className="insight-detail">
          {selectedInsight ? (
            <>
              <header className="detail-head">
                <div>
                  <p className="card-label">{selectedInsight.subtitle}</p>
                  <h3>{selectedInsight.title}</h3>
                </div>
                <span className="pill">{selectedInsight.id}</span>
              </header>
              {selectedInsight.rows.length === 0 ? (
                <p className="empty">No results for this slice.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {selectedInsight.columns.map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInsight.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {selectedInsight.columns.map((col) => (
                            <td key={col}>{formatValue(row[col])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <p className="empty">No insights available.</p>
          )}
        </article>
      </section>
    </div>
  );
}
