/**
 * Translation page: language selection and open in Google Translate (app, text-to-text, voice-to-voice).
 */
import { useState } from 'react';

/** Redirect to Google Translate with current page and selected target language. */
function openInGoogleTranslate(tl: string): void {
  const url =
    typeof window !== 'undefined'
      ? `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(tl)}&u=${encodeURIComponent(window.location.origin + window.location.pathname)}`
      : '#';
  window.open(url, '_self');
}

/** Open Google Translate in a new tab for text or voice (sl, tl, optional text). */
function openGoogleTranslateTextOrVoice(sl: string, tl: string, text?: string): void {
  const params = new URLSearchParams();
  params.set('sl', sl === 'auto' ? 'auto' : sl);
  params.set('tl', tl);
  if (text?.trim()) params.set('text', text.trim());
  const url = `https://translate.google.com/?${params.toString()}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Russian' },
  { code: 'es', label: 'Spanish (Mexican)' },
  { code: 'ka', label: 'Georgian' },
  { code: 'yi', label: 'Yiddish' },
  { code: 'he', label: 'Yevrit' },
];

const SOURCE_OPTIONS = [{ code: 'auto', label: 'Auto' }, ...LANGUAGES];

export default function Translation() {
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('ru');

  const swapLanguages = () => {
    if (sourceLang === 'auto') {
      setSourceLang(targetLang);
      setTargetLang('en');
    } else {
      setSourceLang(targetLang);
      setTargetLang(sourceLang);
    }
  };

  return (
    <div className="rd-page">
      <div className="translation-page rd-premium-panel" style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1>Translation</h1>

        <div style={{ marginTop: '1rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <select
              className="rd-input"
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              style={{ minWidth: 120 }}
              aria-label="Source language"
            >
              {SOURCE_OPTIONS.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rd-btn rd-btn-secondary"
              onClick={swapLanguages}
              aria-label="Swap languages"
              style={{ padding: '0.35rem 0.5rem' }}
            >
              ⇄
            </button>
            <select
              className="rd-input"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              style={{ minWidth: 120 }}
              aria-label="Target language"
            >
              {LANGUAGES.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="rd-btn rd-btn-primary"
              onClick={() => openInGoogleTranslate(targetLang)}
            >
              Open Google Translate
            </button>
            <button
              type="button"
              className="rd-btn rd-btn-secondary"
              onClick={() => openGoogleTranslateTextOrVoice(sourceLang, targetLang)}
            >
              Text to text in Google
            </button>
            <button
              type="button"
              className="rd-btn rd-btn-secondary"
              onClick={() => openGoogleTranslateTextOrVoice(sourceLang, targetLang)}
            >
              Voice to voice in Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
