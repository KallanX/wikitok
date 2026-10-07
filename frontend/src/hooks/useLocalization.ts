import { createContext, useContext } from "react";
import type { Language } from "../languages";

export interface LocalizationContextType {
  currentLanguage: Language;
  setLanguage: (languageId: string) => void;
}

export const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error("useLocalization must be used within a LocalizationProvider");
  }
  return context;
}
