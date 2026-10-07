import { useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { LANGUAGES, Language } from "../languages";
import { isRtlLanguage } from "../lib/language";
import { LocalizationContext } from "../hooks/useLocalization";

function loadLanguage(): Language {
  try {
    const saved = localStorage.getItem("lang");
    return LANGUAGES.find((language) => language.id === saved) || LANGUAGES[0];
  } catch {
    return LANGUAGES[0];
  }
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<Language>(loadLanguage);

  useEffect(() => {
    document.documentElement.lang = currentLanguage.id;
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
