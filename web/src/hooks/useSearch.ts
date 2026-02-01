import { useEffect } from "react";
import { api } from "../api";
import type { SearchResponse } from "../types/api";

export function useSearch(
  searchQuery: string,
  setSearchResults: (results: SearchResponse) => void,
  setSearchLoading: (loading: boolean) => void,
  setSearchError: (error: string | null) => void
) {
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults({ players: [], rosters: [], stats: [] });
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    setSearchLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const response = await api.search({ q: trimmed, limit: 12 });
        setSearchResults(response);
        setSearchError(null);
      } catch (error) {
        console.error(error);
        setSearchError("Search failed");
      } finally {
        setSearchLoading(false);
      }
    }, 200);

    return () => window.clearTimeout(handle);
  }, [searchQuery, setSearchError, setSearchLoading, setSearchResults]);
}
