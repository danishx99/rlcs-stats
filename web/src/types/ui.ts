export type Filters = {
  mode: string;
  scope: string;
  tier: string;
  season: string;
  split: string;
  event: string;
};

export type AsyncViewState = {
  isInitialLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
};
