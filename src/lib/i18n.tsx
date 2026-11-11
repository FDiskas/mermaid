import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import translations from "@/locales/translations.json";
import { readStorage, writeStorage } from "@/lib/storage";
import { setTranslateLanguage, translate, type LanguageCode } from "@/lib/translate";

export const LANGUAGES = Object.keys(translations.languageName) as LanguageCode[];

/** Each language shows its own name, whatever language is active. */
export function languageLabel(code: LanguageCode): string {
  return translations.languageName[code];
}

function detectLanguage(): LanguageCode {
  const stored = readStorage<string | null>("language", null);
  if (stored && (LANGUAGES as string[]).includes(stored)) return stored as LanguageCode;
  const browser = navigator.language.slice(0, 2).toLowerCase();
  return (LANGUAGES as string[]).includes(browser) ? (browser as LanguageCode) : "en";
}

interface I18nValue {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const initial = detectLanguage();
    setTranslateLanguage(initial);
    document.documentElement.lang = initial;
    return initial;
  });

  const setLanguage = useCallback((next: LanguageCode) => {
    // `translate` is a shared mutable object: switch it first, then re-render consumers.
    setTranslateLanguage(next);
    document.documentElement.lang = next;
    writeStorage("language", next);
    setLanguageState(next);
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLanguage(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useLanguage must be used inside <I18nProvider>");
  return ctx;
}

/** Returns the translation table. Subscribes the component to language changes. */
export function useTranslate() {
  useLanguage();
  return translate;
}
