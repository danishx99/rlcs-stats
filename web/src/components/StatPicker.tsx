import { useEffect, useRef, useState } from "react";
import type { StatCategory } from "../types/api";

type StatPickerProps = {
  categories: StatCategory[];
  selected: string[];
  onToggle: (key: string) => void;
};

export default function StatPicker({ categories, selected, onToggle }: StatPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const query = search.toLowerCase().trim();

  const filtered = categories
    .map((cat) => ({
      ...cat,
      stats: cat.stats.filter((stat) =>
        query ? stat.label.toLowerCase().includes(query) : true
      )
    }))
    .filter((cat) => cat.stats.length > 0);

  return (
    <div className="stat-picker" ref={ref}>
      <button
        type="button"
        className="ghost stat-picker-trigger"
        onClick={() => {
          setOpen(!open);
          if (!open) setSearch("");
        }}
      >
        + Add Stat
      </button>
      {open && (
        <div className="stat-picker-popover">
          <input
            ref={inputRef}
            type="text"
            className="stat-picker-search"
            placeholder="Search stats..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="stat-picker-list">
            {filtered.length === 0 && (
              <p className="empty">No stats match your search.</p>
            )}
            {filtered.map((cat) => (
              <div key={cat.name} className="stat-picker-group">
                <div className="stat-picker-group-title">{cat.name}</div>
                <div className="stat-picker-group-grid">
                  {cat.stats.map((stat) => (
                    <label key={stat.key} className="stat-toggle">
                      <input
                        type="checkbox"
                        checked={selected.includes(stat.key)}
                        onChange={() => onToggle(stat.key)}
                      />
                      {stat.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
