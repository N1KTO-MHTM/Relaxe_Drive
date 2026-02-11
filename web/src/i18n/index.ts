/**
 * Multi-language interface: en, ru, es, ka. Language is stored in localStorage
 * and applied on change; components re-render on locale-change event.
 */
import { useState, useEffect } from 'react';
import en from './locales/en.json';
import ru from './locales/ru.json';
import es from './locales/es.json';
import ka from './locales/ka.json';

const LOCALES: Record<string, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  ru: ru as Record<string, unknown>,
  es: es as Record<string, unknown>,
  ka: ka as Record<string, unknown>,
};

const STORAGE_KEY = 'relaxdrive-locale';
const DEFAULT_LANG = 'en';

function get(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o: unknown, k: string) => (o as Record<string, unknown>)?.[k], obj);
}

export function getLocale(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_LANG;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && LOCALES[stored] ? stored : DEFAULT_LANG;
}

export function setLocale(lang: string): void {
  if (!LOCALES[lang]) return;
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, lang);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('locale-change'));
}

export function t(key: string, options?: Record<string, string | number>): string {
  const lang = getLocale();
  const messages = LOCALES[lang] ?? LOCALES[DEFAULT_LANG];
  const raw = get(messages, key);
  if (typeof raw !== 'string') return key;
  let s: string = raw;
  if (options) {
    for (const [k, v] of Object.entries(options)) {
      s = s.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }
  return s;
}

export function useTranslation(): { t: typeof t; i18n: { language: string; changeLanguage: (lng: string) => void } } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((n) => n + 1);
    window.addEventListener('locale-change', handler);
    return () => window.removeEventListener('locale-change', handler);
  }, []);
  return {
    t,
    i18n: { language: getLocale(), changeLanguage: setLocale },
  };
}

export default { t, useTranslation, changeLanguage: setLocale, getLocale };
