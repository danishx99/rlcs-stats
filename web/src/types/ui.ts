import type { SearchResult } from "./api";

export type SearchSection = {
  key: "players" | "rosters" | "stats";
  label: string;
  results: SearchResult[];
};

export type Filters = {
  season: string;
  split: string;
  event: string;
};
