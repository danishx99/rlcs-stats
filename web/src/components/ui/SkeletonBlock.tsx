import type { CSSProperties } from "react";

type SkeletonBlockProps = {
  className?: string;
  height?: number | string;
  width?: number | string;
  rounded?: "sm" | "md" | "lg" | "pill";
};

const RADIUS_BY_SIZE: Record<NonNullable<SkeletonBlockProps["rounded"]>, string> = {
  sm: "6px",
  md: "10px",
  lg: "14px",
  pill: "999px"
};

export default function SkeletonBlock({ className = "", height = 16, width = "100%", rounded = "md" }: SkeletonBlockProps) {
  const style: CSSProperties = {
    height,
    width,
    borderRadius: RADIUS_BY_SIZE[rounded]
  };

  return <div className={`ui-skeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}
