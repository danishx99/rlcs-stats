import { FormEvent, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api";
import type { FeedbackSubmitRequest, FeedbackType } from "../types/api";

const SESSION_STORAGE_KEY = "rlcs_feedback_session_id";
const MESSAGE_MIN_LENGTH = 5;
const MESSAGE_MAX_LENGTH = 2000;

function envFlagEnabled(rawValue: unknown): boolean {
  if (typeof rawValue !== "string") return false;
  return ["1", "true", "yes", "on"].includes(rawValue.trim().toLowerCase());
}

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getFeedbackSessionId() {
  try {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const next = createSessionId();
    localStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return createSessionId();
  }
}

function buildPayload(type: FeedbackType, message: string, pathname: string, search: string, hash: string): FeedbackSubmitRequest {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  return {
    type,
    message,
    page: {
      url: window.location.href,
      path: pathname,
      search,
      hash,
      title: document.title || null
    },
    client: {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      screenWidth: window.screen?.width ?? null,
      screenHeight: window.screen?.height ?? null,
      language: navigator.language ?? null,
      timezone,
      userAgent: navigator.userAgent ?? null,
      platform: navigator.platform ?? null,
      referrer: document.referrer || null,
      submittedAt: new Date().toISOString(),
      sessionId: getFeedbackSessionId()
    }
  };
}

export default function FeedbackWidget() {
  const location = useLocation();
  const enabled = useMemo(() => envFlagEnabled(import.meta.env.VITE_FEEDBACK_ENABLED), []);
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  if (!enabled) return null;

  const trimmedMessage = message.trim();
  const canSubmit = status !== "submitting";

  const closeModal = () => {
    if (status === "submitting") return;
    setOpen(false);
    setStatus("idle");
    setErrorMessage("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (trimmedMessage.length < MESSAGE_MIN_LENGTH) {
      setStatus("error");
      setErrorMessage("Please enter at least 5 characters.");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");
    try {
      const payload = buildPayload(
        feedbackType,
        trimmedMessage,
        location.pathname,
        location.search,
        location.hash
      );
      await api.submitFeedback(payload);
      setStatus("success");
      setMessage("");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to submit feedback.");
    }
  };

  return (
    <>
      <button
        type="button"
        className="feedback-fab"
        onClick={() => {
          setOpen(true);
          setStatus("idle");
          setErrorMessage("");
        }}
      >
        Feedback
      </button>

      {open && (
        <div
          className="feedback-modal-backdrop"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="feedback-modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Submit feedback"
          >
            <div className="feedback-modal-header">
              <h3>Send Feedback</h3>
              <button type="button" className="feedback-modal-close" onClick={closeModal} aria-label="Close feedback dialog">
                ×
              </button>
            </div>

            {status === "success" ? (
              <div className="feedback-success-state">
                <p>Thanks. Your feedback was submitted.</p>
                <div className="feedback-modal-actions">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setStatus("idle");
                      setFeedbackType("bug");
                      setErrorMessage("");
                    }}
                  >
                    Send another
                  </button>
                  <button type="button" onClick={closeModal}>Close</button>
                </div>
              </div>
            ) : (
              <form className="feedback-form" onSubmit={handleSubmit}>
                <label>
                  Type
                  <select
                    value={feedbackType}
                    onChange={(event) => setFeedbackType(event.target.value as FeedbackType)}
                    disabled={status === "submitting"}
                  >
                    <option value="bug">Bug</option>
                    <option value="idea">Idea</option>
                    <option value="question">Question</option>
                  </select>
                </label>

                <label>
                  Message
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value.slice(0, MESSAGE_MAX_LENGTH))}
                    rows={6}
                    placeholder="Tell us what you noticed, what you expected, or what idea you have..."
                    disabled={status === "submitting"}
                  />
                </label>

                <div className="feedback-form-meta">
                  <span>{trimmedMessage.length}/{MESSAGE_MAX_LENGTH}</span>
                </div>

                {status === "error" && (
                  <p className="feedback-form-error">{errorMessage}</p>
                )}

                <div className="feedback-modal-actions">
                  <button type="button" className="ghost" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" disabled={!canSubmit}>
                    {status === "submitting" ? "Sending..." : "Submit"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
