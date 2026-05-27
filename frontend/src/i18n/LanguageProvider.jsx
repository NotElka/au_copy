import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_LANG, getValue, LANGUAGES } from './dictionary';

const STORAGE_KEY = 'aucopy.lang';

const LanguageContext = createContext({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && LANGUAGES.find((l) => l.code === saved)) return saved;
    } catch (_) {}
    return DEFAULT_LANG;
  });

  const setLang = useCallback((next) => {
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((path, vars) => {
    let v = getValue(lang, path);
    if (vars && typeof v === 'string') {
      for (const [k, val] of Object.entries(vars)) {
        v = v.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), val);
      }
    }
    return v;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useT = () => useContext(LanguageContext);
