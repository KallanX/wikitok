import { useState, useEffect, useRef, useMemo } from "react";
import { LANGUAGES } from "../languages";
import { useLocalization } from "../hooks/useLocalization";
import { ChevronDown } from "lucide-react";

export function LanguageSelector() {
  const [showDropdown, setShowDropdown] = useState(false);
  const { currentLanguage, setLanguage } = useLocalization();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sortedLanguages = useMemo(() => {
    return [...LANGUAGES].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const handleClickOutside = (event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node)
    ) {
      setShowDropdown(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-xs text-white/90 hover:text-white transition-all backdrop-blur-md"
        aria-label="Select Wikipedia Language"
        aria-expanded={showDropdown}
      >
        <img
          className="w-3.5 h-3.5 rounded-full object-cover"
          src={currentLanguage.flag}
          alt=""
        />
        <span>{currentLanguage.name}</span>
        <ChevronDown className="w-3 h-3 text-white/60" />
      </button>

      {showDropdown && (
        <div className="absolute overflow-y-auto max-h-[260px] py-1 w-44 right-0 top-full mt-2 bg-gray-900/95 border border-white/10 backdrop-blur-lg rounded-xl shadow-2xl z-50">
          {sortedLanguages.map((language) => (
            <button
              key={language.id}
              onClick={() => {
                setLanguage(language.id);
                setShowDropdown(false);
              }}
              className={`w-full items-center flex gap-2.5 px-3 py-1.5 text-left text-xs transition-colors ${
                language.id === currentLanguage.id
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <img
                className="w-4 h-4 rounded-full object-cover"
                src={language.flag}
                alt=""
              />
              <span className="flex-1 truncate">{language.name}</span>
              {language.id === currentLanguage.id && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
