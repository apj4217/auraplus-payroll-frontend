import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

type Option = { value: string; label: string; sublabel?: string };

type SearchableSelectProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  allOptionLabel?: string;
};

/**
 * A dropdown that behaves like a normal <select> but lets the user
 * type to filter long lists (employees, departments...) instead of
 * scrolling through everything.
 */
export default function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  required = false,
  error,
  disabled = false,
  allOptionLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function select(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="label">{label}{required && <span className="text-red-500"> *</span>}</label>}
      <button
        type="button"
        disabled={disabled}
        className={`input flex items-center justify-between gap-2 text-left ${error ? "input-error" : ""} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selected ? "text-slate-900" : "text-slate-400"}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {error && <p className="field-error">{error}</p>}

      {open && !disabled && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lift">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              autoFocus
              className="w-full text-sm outline-none placeholder:text-slate-400"
              placeholder="Type to search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && <button type="button" onClick={() => setQuery("")}><X size={14} className="text-slate-400" /></button>}
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {allOptionLabel && (
              <button type="button" onClick={() => select("")} className={`flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-orange-50 ${!value ? "bg-orange-50 text-brand-rose" : "text-slate-700"}`}>
                {allOptionLabel}
              </button>
            )}
            {filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                onClick={() => select(o.value)}
                className={`flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-orange-50 ${o.value === value ? "bg-orange-50 text-brand-rose" : "text-slate-700"}`}
              >
                <span className="font-medium">{o.label}</span>
                {o.sublabel && <span className="text-xs text-slate-400">{o.sublabel}</span>}
              </button>
            ))}
            {!filtered.length && <p className="px-3 py-4 text-center text-sm text-slate-400">No matches found.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
