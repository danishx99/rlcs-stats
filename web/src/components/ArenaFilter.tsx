import { useEffect, useRef, useState } from "react";

type ArenaFilterProps = {
  arenas: string[];
  value: string;
  onChange: (next: string) => void;
};

const ALL_LABEL = "All Arenas";

export default function ArenaFilter({ arenas, value, onChange }: ArenaFilterProps) {
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
  const filtered = query
    ? arenas.filter((arena) => arena.toLowerCase().includes(query))
    : arenas;

  const triggerText = value || ALL_LABEL;

  return (
    <div className="stat-picker stat-picker--dropdown" ref={ref}>
      <button
        type="button"
        className="ghost stat-picker-trigger stat-picker-trigger--select"
        onClick={() => {
          setOpen(!open);
          if (!open) setSearch("");
        }}
      >
        {triggerText}
      </button>
      {open && (
        <div className="stat-picker-popover">
          <input
            ref={inputRef}
            type="text"
            className="stat-picker-search"
            placeholder="Search arenas..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="stat-picker-list">
            <div className="stat-picker-group">
              <div className="stat-picker-group-grid">
                <label className="stat-toggle">
                  <input
                    type="radio"
                    name="arena-filter"
                    checked={value === ""}
                    onChange={() => {
                      onChange("");
                      setOpen(false);
                    }}
                  />
                  {ALL_LABEL}
                </label>
                {filtered.map((arena) => (
                  <label key={arena} className="stat-toggle">
                    <input
                      type="radio"
                      name="arena-filter"
                      checked={value === arena}
                      onChange={() => {
                        onChange(arena);
                        setOpen(false);
                      }}
                    />
                    {arena}
                  </label>
                ))}
                {filtered.length === 0 && (
                  <p className="empty">No arenas match your search.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
