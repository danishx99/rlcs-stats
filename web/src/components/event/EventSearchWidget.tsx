import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import type { SearchResponse } from "../../types/api";
import { buildEventPath } from "../../utils/event-routing";
import PanelState from "../ui/PanelState";

const SEARCH_DEBOUNCE_MS = 500;

/**
 * Debounced event-only search input with a dropdown of matching events.
 * Filters out international (LAN) events for parity with the original page-local search.
 */
export default function EventSearchWidget() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse["events"]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const response = await api.search({ q: searchQuery });
        const events = (response.events ?? []).filter(
          (ev) => ev.meta?.scope !== "international"
        );
        setSearchResults(events);
      } catch (err) {
        console.error(err);
        setSearchResults([]);
        setSearchError("Failed to search events.");
      } finally {
        setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults([]);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasSearchResults = searchResults.length > 0;

  return (
    <div className="event-page-search" ref={searchRef}>
      <div className="dash-search-bar">
        <svg className="dash-search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M13 13l4 4" />
        </svg>
        <input
          type="text"
          placeholder="Search events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            type="button"
            className="dash-search-clear"
            onClick={() => { setSearchQuery(""); setSearchResults([]); }}
          >
            &times;
          </button>
        )}
      </div>
      {searchQuery.trim() && (
        <div className="dash-search-dropdown">
          {searchLoading && <p className="dash-search-status">Searching...</p>}
          {!searchLoading && searchError && <PanelState state="error" message={searchError} />}
          {!searchLoading && !searchError && !hasSearchResults && <p className="dash-search-status">No events found</p>}
          {!searchLoading && hasSearchResults && (
            <div className="dash-search-group">
              <div className="dash-search-group-title">Events</div>
              {searchResults.slice(0, 8).map((ev) => (
                <Link
                  key={`${ev.meta?.season}-${ev.meta?.split}-${ev.id}`}
                  className="dash-search-item"
                  to={buildEventPath(ev.id)}
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                >
                  <div className="dash-search-avatar dash-search-avatar--event">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div className="dash-search-item-info">
                    <strong>{ev.label}</strong>
                    <span>{[ev.meta?.season, ev.meta?.split].filter(Boolean).join(" / ")}</span>
                  </div>
                  <span className="dash-search-type">Event</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
