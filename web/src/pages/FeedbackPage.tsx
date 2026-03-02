import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { FeedbackListRow, FeedbackType } from "../types/api";

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
  const [typeFilter, setTypeFilter] = useState<"all" | FeedbackType>("all");
  const [resolvedFilter, setResolvedFilter] = useState<"all" | "resolved" | "unresolved">("all");
  const [reloadTick, setReloadTick] = useState(0);
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadFeedback() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.feedback({
          type: typeFilter === "all" ? undefined : typeFilter,
          resolved: resolvedFilter
        });
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
  }, [reloadTick, resolvedFilter, typeFilter]);

  async function toggleResolved(row: FeedbackListRow) {
    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.add(row.id);
      return next;
    });
    setError(null);
    try {
      await api.updateFeedback(row.id, { resolved: !row.resolved });
      setReloadTick((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to update feedback");
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  }

  return (
    <div className="page page-no-nav">
      <button className="ghost back-button" onClick={() => navigate("/")}>
        &larr; Back to Dashboard
      </button>

      <div>
        <h1 className="page-heading" style={{ marginBottom: 6 }}>Feedback</h1>
        <div className="page-heading-sub">{rows.length} submissions</div>
      </div>

      <div className="feedback-filters">
        <label>
          <span>Type</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | FeedbackType)}>
            <option value="all">All</option>
            <option value="bug">Bug</option>
            <option value="idea">Idea</option>
            <option value="question">Question</option>
          </select>
        </label>

        <label>
          <span>Status</span>
          <select
            value={resolvedFilter}
            onChange={(event) => setResolvedFilter(event.target.value as "all" | "resolved" | "unresolved")}
          >
            <option value="all">All</option>
            <option value="unresolved">Unresolved</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
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
                <th>Status</th>
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
                  <td>
                    <div className="feedback-status-cell">
                      <span className={row.resolved ? "feedback-status feedback-status--resolved" : "feedback-status"}>
                        {row.resolved ? "Resolved" : "Unresolved"}
                      </span>
                      <button
                        type="button"
                        className="ghost"
                        disabled={updatingIds.has(row.id)}
                        onClick={() => toggleResolved(row)}
                      >
                        {row.resolved ? "Mark unresolved" : "Mark resolved"}
                      </button>
                    </div>
                  </td>
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
