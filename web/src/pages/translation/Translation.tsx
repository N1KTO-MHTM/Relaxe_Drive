/**
 * Translation page: in-app voice-to-voice; open in Google Translate (on desktop: browser; on mobile: app or download prompt).
 */
import { useState, useCallback, useRef } from 'react';
import { api } from '../../api/client';

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

/** Android intent to open Google Translate app; fallback to Play Store. */
const ANDROID_TRANSLATE_INTENT =
  'intent://translate.google.com/#Intent;scheme=https;package=com.google.android.apps.translate;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.google.android.apps.translate;end';
/** iOS URL scheme to open Google Translate app. */
const IOS_TRANSLATE_APP = 'googletranslate://';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.google.android.apps.translate';
const APP_STORE_URL = 'https://apps.apple.com/app/google-translate/id414706506';

/** On mobile: try to open Google Translate app; show download message. Never open translate in browser on mobile. */
function openTranslateOnMobile(): void {
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  if (isAndroid) {
    window.location.href = ANDROID_TRANSLATE_INTENT;
  } else if (isIOS) {
    window.location.href = IOS_TRANSLATE_APP;
  }
  // If app doesn't open, we show the download block (always visible on mobile after tap)
}

/** On desktop: open Google Translate in browser (current page or new tab). */
function openInGoogleTranslateDesktop(tl: string): void {
  const url = `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(tl)}&u=${encodeURIComponent(window.location.origin + window.location.pathname)}`;
  window.open(url, '_self');
}

function openGoogleTranslateVoiceDesktop(sl: string, tl: string): void {
  const params = new URLSearchParams();
  params.set('sl', sl === 'auto' ? 'auto' : sl);
  params.set('tl', tl);
  const url = `https://translate.google.com/?${params.toString()}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Web Speech API: get SpeechRecognition constructor. */
function getSpeechRecognition(): (new () => {
  start(): void;
  stop(): void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: () => void;
  onend: () => void;
  onerror: () => void;
  onresult: (e: { results: { 0?: { 0?: { transcript?: string } } } }) => void;
}) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return (w.SpeechRecognition || w.webkitSpeechRecognition) as ReturnType<typeof getSpeechRecognition>;
}

function toRecognitionLang(code: string): string {
  const map: Record<string, string> = {
    en: 'en-US',
    ru: 'ru-RU',
    es: 'es-ES',
    ka: 'ka-GE',
    yi: 'yi',
    he: 'he-IL',
  };
  return map[code] || code;
}

function toSpeechLang(code: string): string {
  const map: Record<string, string> = {
    en: 'en-US',
    ru: 'ru-RU',
    es: 'es-ES',
    ka: 'ka-GE',
    yi: 'yi',
    he: 'he-IL',
  };
  return map[code] || code;
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
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'translating' | 'speaking'>('idle');
  const [voiceError, setVoiceError] = useState('');
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const recognitionRef = useRef<{ start(): void; stop(): void } | null>(null);

  const translate = useCallback(
    async (text: string): Promise<string> => {
      const raw = text.trim();
      if (!raw) return '';
      setVoiceError('');
      try {
        const res = await api.post<{
          sourceText: string;
          targetText: string;
          sourceLang: string;
          targetLang: string;
        }>('/translation/translate', {
          sourceText: raw,
          sourceLang,
          targetLang,
        });
        const out = res.targetText || '';
        setTranslatedText(out);
        setInputText(raw);
        return out;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Translation failed';
        setVoiceError(msg);
        return '';
      }
    },
    [sourceLang, targetLang],
  );

  const speak = useCallback(
    (text: string) => {
      if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
        setVoiceStatus('idle');
        return;
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = toSpeechLang(targetLang);
      u.rate = 0.9;
      u.onend = () => setVoiceStatus('idle');
      u.onerror = () => setVoiceStatus('idle');
      setVoiceStatus('speaking');
      window.speechSynthesis.speak(u);
    },
    [targetLang],
  );

  const startVoiceToVoice = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setVoiceError('Voice input is not supported in this browser. Try Chrome.');
      return;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = sourceLang === 'auto' ? 'en-US' : toRecognitionLang(sourceLang);
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setVoiceStatus('listening');
      setVoiceError('');
    };
    recognition.onend = () => setVoiceStatus((s) => (s === 'listening' ? 'idle' : s));
    recognition.onerror = () => setVoiceStatus('idle');

    recognition.onresult = (event: { results: { 0?: { 0?: { transcript?: string } } } }) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (!transcript) {
        setVoiceStatus('idle');
        return;
      }
      setVoiceStatus('translating');
      translate(transcript).then((out) => {
        if (out) speak(out);
        else setVoiceStatus('idle');
      });
    };

    recognition.start();
  }, [sourceLang, translate, speak]);

  const swapLanguages = () => {
    if (sourceLang === 'auto') {
      setSourceLang(targetLang);
      setTargetLang('en');
    } else {
      setSourceLang(targetLang);
      setTargetLang(sourceLang);
    }
  };

  const mobile = isMobile();

  const handleOpenGoogleTranslate = () => {
    if (mobile) openTranslateOnMobile();
    else openInGoogleTranslateDesktop(targetLang);
  };

  const handleVoiceToVoiceGoogle = () => {
    if (mobile) openTranslateOnMobile();
    else openGoogleTranslateVoiceDesktop(sourceLang, targetLang);
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
            <button type="button" className="rd-btn rd-btn-primary" onClick={handleOpenGoogleTranslate}>
              Open Google Translate
            </button>
            <button type="button" className="rd-btn rd-btn-secondary" onClick={handleVoiceToVoiceGoogle}>
              Voice to voice in Google
            </button>
          </div>

          {mobile && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem',
                background: 'var(--rd-bg-muted, rgba(255,255,255,0.06))',
                borderRadius: 'var(--rd-radius)',
                fontSize: '0.875rem',
              }}
            >
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600 }}>Don&apos;t have the Google Translate app?</p>
              <p className="rd-text-muted" style={{ margin: '0 0 0.5rem 0' }}>
                Download it to translate on this device. Translation will not open in the browser.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rd-btn rd-btn-secondary"
                  style={{ fontSize: '0.875rem' }}
                >
                  Get it on Google Play
                </a>
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rd-btn rd-btn-secondary"
                  style={{ fontSize: '0.875rem' }}
                >
                  Download on App Store
                </a>
              </div>
            </div>
          )}
        </div>

        {/* In-app voice to voice */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--rd-border)' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Voice to voice (in app)</h2>
          <p className="rd-text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            Speak in the source language; the app will transcribe, translate, and speak the result. Works best in Chrome.
          </p>
          {voiceError && (
            <p className="rd-text-critical" style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              {voiceError}
            </p>
          )}
          {(inputText || translatedText) && (
            <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>
              {inputText && <p style={{ margin: '0 0 0.25rem 0' }}><strong>Heard:</strong> {inputText}</p>}
              {translatedText && <p style={{ margin: 0 }}><strong>Translation:</strong> {translatedText}</p>}
            </div>
          )}
          <button
            type="button"
            className="rd-btn rd-btn-primary"
            onClick={startVoiceToVoice}
            disabled={voiceStatus !== 'idle'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {voiceStatus === 'idle' && (
              <>
                <span aria-hidden>🎤</span>
                Listen & translate
              </>
            )}
            {voiceStatus === 'listening' && (
              <>
                <span aria-hidden>🔴</span>
                Listening…
              </>
            )}
            {voiceStatus === 'translating' && 'Translating…'}
            {voiceStatus === 'speaking' && (
              <>
                <span aria-hidden>🔊</span>
                Speaking…
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
