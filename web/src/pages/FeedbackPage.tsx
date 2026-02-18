import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { FeedbackListRow } from "../types/api";

function formatDate(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}

function stringifyContext(value: Record<string, unknown> | null) {
  if (!value) return "";
  return JSON.stringify(value, null, 2);
}

export default function FeedbackPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<FeedbackListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFeedback() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.feedback();
        if (!cancelled) {
          setRows(response.rows ?? []);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Failed to load feedback");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadFeedback();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page page-no-nav">
      <button className="ghost back-button" onClick={() => navigate("/")}>
        &larr; Back to Dashboard
      </button>

      <div className="stat-page-header">
        <h1>Feedback</h1>
        <div className="stat-page-subtitle">{rows.length} submissions</div>
      </div>

      {loading && <div className="loading">Loading feedback...</div>}
      {error && <div className="error">{error}</div>}
      {!loading && !error && rows.length === 0 && <div className="empty-state">No feedback submissions yet.</div>}

      {!loading && !error && rows.length > 0 && (
        <div className="table-wrap feedback-table-wrap">
          <table className="results-table feedback-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Created</th>
                <th>Type</th>
                <th>Message</th>
                <th>Page</th>
                <th>Client</th>
                <th>Server</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>{row.type}</td>
                  <td className="feedback-message">{row.message}</td>
                  <td>
                    <div className="feedback-page-info">
                      <div>{row.page.path}</div>
                      {row.page.title ? <div>{row.page.title}</div> : null}
                      <div>{row.page.url}</div>
                      {row.page.search ? <div>{row.page.search}</div> : null}
                      {row.page.hash ? <div>{row.page.hash}</div> : null}
                    </div>
                  </td>
                  <td>
                    <pre className="feedback-context">{stringifyContext(row.client)}</pre>
                  </td>
                  <td>
                    <pre className="feedback-context">{stringifyContext(row.server)}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
