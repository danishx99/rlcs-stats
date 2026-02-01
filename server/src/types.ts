export type StatOption = {
  key: string;
  label: string;
  column?: string;
  format?: "int" | "float" | "pct";
  kind?: "series_played";
};

export type FeaturedInsight = {
  key: string;
  label: string;
  format?: "int" | "float" | "pct";
  order?: "asc" | "desc";
  sql: (where: string, limitIndex: number) => string;
};

export type Insight = {
  id: string;
  title: string;
  subtitle: string;
  sql: string;
};
