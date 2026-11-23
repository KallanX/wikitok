import { useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { LANGUAGES, Language } from "../languages";
import { isRtlLanguage, languageFromId, languageFromNavigator } from "../lib/language";
import { readFeedLocation } from "../lib/variantUrl";
import { LocalizationContext } from "../hooks/useLocalization";

function loadLanguage(): Language {
  if (typeof window !== "undefined") {
    const fromUrl = readFeedLocation(window.location.search).lang;
    const urlMatch = fromUrl ? languageFromId(fromUrl) : undefined;
    if (urlMatch) return urlMatch;
  }
  try {
    const saved = localStorage.getItem("lang");
    if (saved) return LANGUAGES.find((language) => language.id === saved) || LANGUAGES[0];
  } catch {
    return LANGUAGES[0];
  }
  if (typeof navigator !== "undefined") {
    const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
    return languageFromNavigator(tags);
  }
  return LANGUAGES[0];
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<Language>(loadLanguage);

  useEffect(() => {
    document.documentElement.lang = "en";
    document.documentElement.dir = isRtlLanguage(currentLanguage.id) ? "rtl" : "ltr";
    try {
      localStorage.setItem("lang", currentLanguage.id);
    } catch {
      // Ignore private-mode and quota failures.
    }
  }, [currentLanguage]);

  const setLanguage = useCallback((languageId: string) => {
    const nextLang = LANGUAGES.find((language) => language.id === languageId);
    setCurrentLanguage((current) => {
      if (!nextLang || nextLang.id === current.id) return current;
      return nextLang;
    });
  }, []);

  const value = useMemo(() => ({ currentLanguage, setLanguage }), [currentLanguage, setLanguage]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}
