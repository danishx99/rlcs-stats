import SkeletonBlock from "./SkeletonBlock";

type SkeletonRowsProps = {
  rows?: number;
  rowHeight?: number;
  className?: string;
};

export default function SkeletonRows({ rows = 4, rowHeight = 16, className = "" }: SkeletonRowsProps) {
  return (
    <div className={`ui-skeleton-rows ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonBlock
          key={`skeleton-row-${index}`}
          height={rowHeight}
          width={index === rows - 1 ? "78%" : "100%"}
          rounded="sm"
        />
      ))}
    </div>
  );
}
