import type { SearchResult } from "../types/api";
import type { SearchSection } from "../types/ui";
import { proxyImageUrl } from "../utils/normalize";

const MAX_RESULTS_PER_SECTION = 6;

type SearchResultsProps = {
  sections: SearchSection[];
  onView: (item: SearchResult) => void;
  onCompare?: (item: SearchResult) => void;
  onTopStat: (item: SearchResult) => void;
  renderWrapper?: boolean;
};

function sectionResults(results: SearchResult[]) {
  return results.slice(0, MAX_RESULTS_PER_SECTION);
}

export default function SearchResults({
  sections,
  onView,
  onCompare,
  onTopStat,
  renderWrapper = true
}: SearchResultsProps) {
  const visibleSections = sections.filter((section) => section.results.length > 0);
  const hasResults = visibleSections.length > 0;

  if (!hasResults) {
    return null;
  }

  const content = visibleSections.map((section) => (
    <div key={section.key} className="search-section">
      <p className="search-section-title">{section.label}</p>
      <ul>
        {sectionResults(section.results).map((item) => (
          <li key={`${item.type}-${item.id}`}>
            <div className="result-main">
              {(item.type === "player" || item.type === "roster") && (
                <div className={`result-avatar${item.type === "roster" ? " result-avatar--logo" : ""}`}>
                  {proxyImageUrl(item.meta?.photoUrl) ? (
                    <img src={proxyImageUrl(item.meta?.photoUrl)!} alt="" />
                  ) : (
                    item.label.charAt(0)
                  )}
                </div>
              )}
              <div>
                <strong>{item.label}</strong>
                {item.type === "player" && item.meta?.realName ? (
                  <span className="result-meta">{item.meta.realName}</span>
                ) : null}
                {item.type === "roster" && item.meta?.starters?.length ? (
                  <span className="result-meta">{item.meta.starters.join(" / ")}</span>
                ) : null}
              </div>
            </div>
            <div className="result-actions">
              {item.type === "stat" ? (
                <button className="ghost" onClick={() => onTopStat(item)}>
                  Top 10
                </button>
              ) : (
                <button className="ghost" onClick={() => onView(item)}>
                  View
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  ));

  if (!renderWrapper) {
    return <>{content}</>;
  }

  return <div className="search-results">{content}</div>;
}
