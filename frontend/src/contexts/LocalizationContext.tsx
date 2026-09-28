import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { LANGUAGES, Language } from "../languages";

interface LocalizationContextType {
  currentLanguage: Language;
  setLanguage: (languageId: string) => void;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("lang");
    return LANGUAGES.find((l) => l.id === saved) || LANGUAGES[0];
  });

  useEffect(() => {
    localStorage.setItem("lang", currentLanguage.id);
  }, [currentLanguage]);

  const setLanguage = (languageId: string) => {
    const nextLang = LANGUAGES.find((l) => l.id === languageId);
    if (nextLang && nextLang.id !== currentLanguage.id) {
      setCurrentLanguage(nextLang);
    }
  };

  return (
    <LocalizationContext.Provider value={{ currentLanguage, setLanguage }}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error("useLocalization must be used within a LocalizationProvider");
  }
  return context;
}
