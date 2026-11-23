import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { LANGUAGES } from "../languages";
import { useLocalization } from "../hooks/useLocalization";
import { ChevronDown } from "lucide-react";

export function LanguageSelector() {
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const { currentLanguage, setLanguage } = useLocalization();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const sortedLanguages = useMemo(() => {
    return [...LANGUAGES].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sortedLanguages;
    return sortedLanguages.filter(
      (language) =>
        language.name.toLowerCase().includes(needle) || language.id.toLowerCase().includes(needle)
    );
  }, [query, sortedLanguages]);

  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  useEffect(() => {
    if (!showDropdown) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [showDropdown]);

  useEffect(() => {
    const option = listRef.current?.querySelector<HTMLElement>(`[data-lang-index="${highlight}"]`);
    option?.scrollIntoView({ block: "nearest" });
  }, [highlight, showDropdown]);

  const choose = useCallback(
    (languageId: string) => {
      setLanguage(languageId);
      setShowDropdown(false);
      setQuery("");
      setHighlight(0);
    },
    [setLanguage]
  );

  useEffect(() => {
    if (!showDropdown) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setShowDropdown(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setHighlight((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setHighlight((current) => Math.max(current - 1, 0));
        return;
      }
      if (event.key === "Enter" && filtered[highlight]) {
        event.preventDefault();
        event.stopPropagation();
        choose(filtered[highlight].id);
        return;
      }
      if (event.key.toLowerCase() === "j" || event.key.toLowerCase() === "k" || event.key.toLowerCase() === "l") {
        if (event.target instanceof HTMLInputElement) return;
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [showDropdown, filtered, highlight, choose]);

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      <button
        onClick={() => {
          setHighlight(0);
          setShowDropdown((open) => !open);
        }}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-xs text-white/90 hover:text-white transition-all backdrop-blur-md"
        aria-label="Select Wikipedia Language"
        aria-haspopup="listbox"
        aria-expanded={showDropdown}
      >
        <img className="w-3.5 h-3.5 rounded-full object-cover" src={currentLanguage.flag} alt="" />
        <span className="max-w-24 truncate">{currentLanguage.name}</span>
        <ChevronDown className="w-3 h-3 text-white/60" />
      </button>

      {showDropdown && (
        <div className="absolute end-0 top-full mt-2 w-56 bg-gray-900/95 border border-white/10 backdrop-blur-lg rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-2 border-b border-white/10">
            <label htmlFor="language-search" className="sr-only">
              Search languages
            </label>
            <input
              id="language-search"
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlight(0);
              }}
              placeholder="Search languages"
              className="w-full bg-black/40 text-white text-xs px-2.5 py-1.5 rounded-lg border border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            />
          </div>
          <div
            ref={listRef}
            role="listbox"
            aria-label="Wikipedia languages"
            className="overflow-y-auto max-h-[260px] py-1"
          >
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-white/50">No languages match.</p>
            )}
            {filtered.map((language, index) => (
              <button
                key={language.id}
                data-lang-index={index}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(language.id)}
                role="option"
                aria-selected={language.id === currentLanguage.id}
                className={`w-full items-center flex gap-2.5 px-3 py-1.5 text-start text-xs transition-colors ${
                  index === highlight || language.id === currentLanguage.id
                    ? "bg-white/15 text-white font-medium"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <img className="w-4 h-4 rounded-full object-cover" src={language.flag} alt="" />
                <span className="flex-1 truncate">{language.name}</span>
                {language.id === currentLanguage.id && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
