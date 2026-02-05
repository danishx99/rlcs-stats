export type StatOption = {
  key: string;
  label: string;
  column?: string;
  format?: "int" | "float" | "pct";
  kind?: "series_played" | "rating";
};

export type FeaturedColumn = {
  key: string;
  label: string;
  format?: "int" | "float" | "pct";
};

export type FeaturedInsight = {
  key: string;
  label: string;
  format?: "int" | "float" | "pct";
  order?: "asc" | "desc";
  columns: FeaturedColumn[];
  sql: (where: string, limitIndex: number) => string;
};

export type StatCategory = {
  name: string;
  stats: StatOption[];
};

export type Insight = {
  id: string;
  title: string;
  subtitle: string;
  sql: string;
};
