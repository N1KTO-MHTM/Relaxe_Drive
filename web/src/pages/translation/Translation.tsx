/**
 * Translation page for drivers: text translation UI (source/target, input/output)
 * plus page-language buttons. Uses backend POST /translation/translate (LibreTranslate).
 */
import { useState, useCallback } from 'react';
import { api } from '../../api/client';

/** Redirect to Google Translate with current page and selected target language. */
function openInGoogleTranslate(tl: string): void {
  const url = typeof window !== 'undefined'
    ? `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(tl)}&u=${encodeURIComponent(window.location.origin + window.location.pathname)}`
    : '#';
  window.open(url, '_self');
}

function setGoogleTranslateLanguage(langCode: string): void {
  try {
    const combo = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
    if (combo && langCode) {
      combo.value = langCode;
      combo.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } catch {
    // ignore
  }
}

const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Russian' },
  { code: 'ka', label: 'Georgian' },
  { code: 'es', label: 'Spanish' },
  { code: 'he', label: 'Hebrew (Evrit)' },
  { code: 'yi', label: 'Yiddish' },
];

const SOURCE_OPTIONS = [{ code: 'auto', label: 'Auto' }, ...LANGUAGES];

export default function Translation() {
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('ru');
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState('');

  const translate = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed) {
      setTranslatedText('');
      setError('');
      return;
    }
    setError('');
    setTranslating(true);
    try {
      const res = await api.post<{
        sourceText: string;
        targetText: string;
        sourceLang: string;
        targetLang: string;
      }>('/translation/translate', {
        sourceText: trimmed,
        sourceLang,
        targetLang,
      });
      setTranslatedText(res.targetText || '');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Translation failed';
      setError(msg);
      setTranslatedText('');
    } finally {
      setTranslating(false);
    }
  }, [inputText, sourceLang, targetLang]);

  const swapLanguages = () => {
    if (sourceLang === 'auto') {
      setSourceLang(targetLang);
      setTargetLang('en');
    } else {
      setSourceLang(targetLang);
      setTargetLang(sourceLang);
    }
    setInputText(translatedText);
    setTranslatedText(inputText);
  };

  return (
    <div className="rd-page">
      <div className="translation-page rd-premium-panel" style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1>Translation</h1>

        {/* Text translation UI (image 1 concept) */}
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
                <option key={code} value={code}>{label}</option>
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
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="rd-label" style={{ display: 'block', marginBottom: '0.25rem' }}>
                Enter text
              </label>
              <textarea
                className="rd-input"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Enter text"
                rows={5}
                style={{ width: '100%', resize: 'vertical', minHeight: 100 }}
                aria-label="Text to translate"
              />
            </div>
            <div>
              <label className="rd-label" style={{ display: 'block', marginBottom: '0.25rem' }}>
                Translation
              </label>
              <div
                className="rd-input"
                style={{
                  minHeight: 100,
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--rd-bg)',
                  border: '1px solid var(--rd-border)',
                  borderRadius: 'var(--rd-radius)',
                  color: 'var(--rd-text)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
                aria-live="polite"
              >
                {translatedText || (translating ? '…' : '')}
              </div>
            </div>
          </div>

          {error && (
            <p className="rd-text-critical" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
              {error}
            </p>
          )}

          <button
            type="button"
            className="rd-btn rd-btn-primary"
            onClick={translate}
            disabled={translating || !inputText.trim()}
            style={{ marginTop: '0.75rem' }}
          >
            {translating ? 'Translating…' : 'Translate'}
          </button>
        </div>

        {/* Open app in Google Translate — redirect by language */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--rd-border)' }}>
          <p className="rd-text-muted" style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            Open this app in Google Translate: choose a language and you will be redirected to view the app in that language.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {LANGUAGES.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                className="rd-btn rd-btn-primary"
                style={{ fontSize: '0.875rem' }}
                onClick={() => openInGoogleTranslate(code)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
