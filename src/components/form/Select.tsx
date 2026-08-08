import { useState, useRef, useEffect, useMemo, useCallback } from "react";

interface Option {
  value: string | number;
  label: string;
}

interface SelectProps {
  options: Option[];
  placeholder?: string;
  onChange: (value: string | number) => void;
  className?: string;
  defaultValue?: string | number;
  isPlaceHolderDisabled?: boolean;
  /**
   * Force the type-to-filter box on or off. Left undefined (the default) it
   * turns itself on once the list is long enough to be worth searching, so
   * short pickers like "5 / 10 / 25 / 50" stay clean.
   */
  searchable?: boolean;
  /** Option count at which search auto-enables. */
  searchThreshold?: number;
}

const DEFAULT_SEARCH_THRESHOLD = 7;

const Select: React.FC<SelectProps> = ({
  options,
  placeholder = "Select an option",
  isPlaceHolderDisabled = true,
  onChange,
  className = "",
  defaultValue = "",
  searchable,
  searchThreshold = DEFAULT_SEARCH_THRESHOLD,
}) => {
  const [selectedValue, setSelectedValue] = useState<string | number>(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Keep the displayed value in step when the PARENT changes defaultValue
  // (edit modals reuse the same mounted Select for different rows). Compared
  // by value, so a re-render with the same default never clobbers a choice
  // the user just made.
  const prevDefault = useRef(defaultValue);
  useEffect(() => {
    if (prevDefault.current !== defaultValue) {
      prevDefault.current = defaultValue;
      setSelectedValue(defaultValue);
    }
  }, [defaultValue]);

  const showSearch = searchable ?? options.length > searchThreshold;

  const selectedLabel = options.find(opt => opt.value === selectedValue)?.label || placeholder;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // Substring match anywhere in the label — typing "moz" finds
    // "Fresh Mozzarella".
    return options.filter(o => String(o.label).toLowerCase().includes(q));
  }, [options, query]);

  // Opening and closing are done in handlers, NOT in an effect. An effect
  // keyed on `options` would re-run whenever the parent re-rendered (nearly
  // every call site builds its options array inline, so it is a new identity
  // each time) and would wipe whatever the user had typed mid-search.
  const openList = useCallback((seed = "") => {
    setQuery(seed);
    setHighlight(Math.max(0, options.findIndex(o => o.value === selectedValue)));
    setIsOpen(true);
  }, [options, selectedValue]);

  const closeList = useCallback((returnFocus = false) => {
    setIsOpen(false);
    setQuery("");
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Close on outside click. Goes through closeList so the abandoned query is
  // dropped too — otherwise reopening would land on a still-filtered list.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeList();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, closeList]);

  // Put the caret in the search box on open so the user can just start typing.
  // Deps are deliberately only [isOpen, showSearch].
  useEffect(() => {
    if (!isOpen || !showSearch) return;
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isOpen, showSearch]);

  // Typing resets the cursor to the first match.
  useEffect(() => { setHighlight(0); }, [query]);

  // Keep the highlighted row inside the scroll viewport. Trimming the ref
  // array first means a shrinking filter can't leave us holding a node that
  // React has already detached.
  useEffect(() => {
    if (!isOpen) return;
    optionRefs.current.length = visible.length;
    optionRefs.current[highlight]?.scrollIntoView({ block: "nearest" });
  }, [highlight, isOpen, visible.length]);

  const handleSelect = useCallback((value: string | number) => {
    setSelectedValue(value);
    onChange(value);
    setIsOpen(false);
    setQuery("");
  }, [onChange]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) { openList(); return; }
      setHighlight(h => Math.min(h + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (!isOpen) return;
      e.preventDefault();
      const opt = visible[highlight];
      if (opt) handleSelect(opt.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeList(true);
    } else if (e.key === "Tab") {
      closeList();
    }
  };

  // Typing a letter while the closed trigger is focused opens the list and
  // seeds the filter, the way a native <select> jumps to a letter.
  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && showSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openList(e.key);
      return;
    }
    onKeyDown(e);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? closeList() : openList())}
        onKeyDown={onTriggerKeyDown}
        className={`h-11 w-full appearance-none rounded-lg border-2 bg-white px-4 py-2.5 pr-11 text-sm text-left shadow-sm hover:border-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-gray-800 dark:hover:border-gray-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20 transition-all duration-200 ${isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 dark:border-indigo-500'
            : 'border-gray-200 dark:border-gray-600'
          } ${selectedValue
            ? "text-gray-800 dark:text-white/90"
            : "text-gray-400 dark:text-gray-400"
          }`}
      >
        <span className="block truncate">{selectedLabel}</span>
      </button>

      {/* Arrow icon */}
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-xl overflow-hidden">
          {showSearch && (
            <div className="sticky top-0 z-10 border-b border-gray-100 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Type to search…"
                  className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto">
            {/* Clear-selection row. Kept visible while filtering so you can
                always get back to "no selection" without clearing the query
                first. */}
            {!isPlaceHolderDisabled && selectedValue !== "" && (
              <div
                onClick={() => handleSelect("")}
                className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700"
              >
                {placeholder}
              </div>
            )}

            {visible.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                No matches for “{query}”
              </div>
            ) : (
              visible.map((option, i) => (
                <div
                  key={String(option.value)}
                  ref={(el) => { optionRefs.current[i] = el; }}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${selectedValue === option.value
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-medium'
                      : i === highlight
                        ? 'bg-gray-50 text-gray-900 dark:bg-gray-700 dark:text-white'
                        : 'text-gray-900 dark:text-white'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{option.label}</span>
                    {selectedValue === option.value && (
                      <svg className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Select;
