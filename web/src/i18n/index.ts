/**
 * English-only strings. Google Translate widget is used for other languages.
 * All UI text is in English here; users translate the page via Google Translate.
 */
import en from './locales/en.json';

function get(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o: unknown, k: string) => (o as Record<string, unknown>)?.[k], obj);
}

export function t(key: string, options?: Record<string, string | number>): string {
  const raw = get(en as Record<string, unknown>, key);
  if (typeof raw !== 'string') return key;
  let s: string = raw;
  if (options) {
    for (const [k, v] of Object.entries(options)) {
      s = s.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }
  return s;
}

export function useTranslation(): { t: typeof t; i18n: { language: string; changeLanguage: (_: string) => void } } {
  return {
    t,
    i18n: { language: 'en', changeLanguage: () => {} },
  };
}

/** No-op for backend locale; page translation is via Google Translate widget. */
function changeLanguage(_locale: string): void {}

export default { t, useTranslation, changeLanguage };
