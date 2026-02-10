import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useToastStore } from '../../store/toast';
import './Translation.css';

const LANG_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'auto', labelKey: 'translation.langAuto' },
  { value: 'en', labelKey: 'translation.langEn' },
  { value: 'es', labelKey: 'translation.langEs' },
  { value: 'ru', labelKey: 'translation.langRu' },
  { value: 'he', labelKey: 'translation.langHe' },
  { value: 'yi', labelKey: 'translation.langYi' },
  { value: 'ka', labelKey: 'translation.langKa' },
  { value: 'fr', labelKey: 'translation.langFr' },
  { value: 'de', labelKey: 'translation.langDe' },
  { value: 'uk', labelKey: 'translation.langUk' },
];

const TARGET_LANGS = LANG_OPTIONS.filter((o) => o.value !== 'auto');

interface SpeechRecognitionEvent extends Event {
  results: { length: number; [i: number]: unknown };
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

interface TranslationRecord {
  id: string;
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  targetText: string;
  createdAt: string;
}

export default function Translation() {
  const { t } = useTranslation();
  const toast = useToastStore();
  const [sourceText, setSourceText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [result, setResult] = useState<{ sourceText: string; targetText: string; sourceLang: string; targetLang: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<TranslationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [liveMode, setLiveMode] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [liveVoiceToVoice, setLiveVoiceToVoice] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const liveTranslateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveVoiceToVoiceRef = useRef(liveVoiceToVoice);
  const sourceLangRef = useRef(sourceLang);
  const targetLangRef = useRef(targetLang);
  const speakQueueRef = useRef<{ text: string; lang: string }[]>([]);
  liveVoiceToVoiceRef.current = liveVoiceToVoice;
  sourceLangRef.current = sourceLang;
  targetLangRef.current = targetLang;

  const runTranslate = (text: string) => {
    if (!text.trim() || sourceLang === targetLang) return;
    setLoading(true);
    setResult(null);
    api
      .post<{ sourceText: string; targetText: string; sourceLang: string; targetLang: string }>('/translation/translate', {
        sourceText: text,
        sourceLang,
        targetLang,
      })
      .then((data) => setResult(data ?? null))
      .catch(() => toast.error(t('translation.errorTranslate')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!liveMode || !sourceText.trim()) return;
    if (sourceLang === targetLang) {
      setResult({ sourceText: sourceText, targetText: sourceText, sourceLang, targetLang });
      return;
    }
    if (liveTranslateTimeoutRef.current) clearTimeout(liveTranslateTimeoutRef.current);
    liveTranslateTimeoutRef.current = setTimeout(() => runTranslate(sourceText), 700);
    return () => {
      if (liveTranslateTimeoutRef.current) clearTimeout(liveTranslateTimeoutRef.current);
      liveTranslateTimeoutRef.current = null;
    };
  }, [liveMode, sourceText, sourceLang, targetLang]);

  useEffect(() => {
    let mounted = true;
    setHistoryLoading(true);
    api
      .get<TranslationRecord[]>('/translation/history?limit=30')
      .then((data) => {
        if (mounted && Array.isArray(data)) setHistory(data);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setHistoryLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [result]);

  function handleTranslate() {
    const text = sourceText.trim();
    if (!text) return;
    runTranslate(text);
  }

  function speakTranslation() {
    const text = result?.targetText?.trim();
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
      if (typeof window !== 'undefined' && !window.speechSynthesis) toast.error('Speech not supported in this browser.');
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      speakQueueRef.current = [];
      setSpeaking(false);
      return;
    }
    speakQueueRef.current = [];
    const utterance = new SpeechSynthesisUtterance(text);
    const langMap: Record<string, string> = {
      en: 'en-US', es: 'es-MX', ru: 'ru-RU', he: 'he-IL', yi: 'yi-001', ka: 'ka-GE',
      fr: 'fr-FR', de: 'de-DE', uk: 'uk-UA',
    };
    utterance.lang = langMap[targetLang] || targetLang || 'en-US';
    utterance.rate = 0.95;
    utterance.onend = utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  function flushSpeakQueue() {
    if (typeof window === 'undefined' || !window.speechSynthesis || speakQueueRef.current.length === 0) return;
    const next = speakQueueRef.current.shift();
    if (!next) return;
    const utterance = new SpeechSynthesisUtterance(next.text);
    const langMap: Record<string, string> = {
      en: 'en-US', es: 'es-MX', ru: 'ru-RU', he: 'he-IL', yi: 'yi-001', ka: 'ka-GE',
      fr: 'fr-FR', de: 'de-DE', uk: 'uk-UA',
    };
    utterance.lang = langMap[next.lang] || next.lang || 'en-US';
    utterance.rate = 0.95;
    utterance.onend = utterance.onerror = () => {
      setSpeaking(false);
      if (speakQueueRef.current.length > 0) flushSpeakQueue();
    };
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  function speakText(text: string, lang?: string) {
    if (!text.trim() || typeof window === 'undefined' || !window.speechSynthesis) return;
    const l = lang ?? targetLang;
    const langMap: Record<string, string> = {
      en: 'en-US', es: 'es-MX', ru: 'ru-RU', he: 'he-IL', yi: 'yi-001', ka: 'ka-GE',
      fr: 'fr-FR', de: 'de-DE', uk: 'uk-UA',
    };
    const item = { text: text.trim(), lang: langMap[l] ? l : l };
    if (speaking) {
      speakQueueRef.current.push(item);
      return;
    }
    window.speechSynthesis.cancel();
    speakQueueRef.current = [item];
    flushSpeakQueue();
  }

  function startVoiceInput() {
    const Win = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRecognitionAPI = Win.SpeechRecognition || Win.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      toast.error(t('translation.voiceToText') + ' — not supported in this browser.');
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = sourceLang === 'auto' ? '' : sourceLang;
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const last = e.results.length - 1;
      const res = e.results[last] as unknown as { length: number; isFinal: boolean; [i: number]: { transcript: string } };
      const transcript = res.length > 0 ? res[0].transcript : '';
      if (res.isFinal && transcript) {
        setSourceText((prev) => (prev ? `${prev} ${transcript}` : transcript).trim());
        if (liveVoiceToVoiceRef.current && sourceLangRef.current !== targetLangRef.current) {
          api
            .post<{ sourceText: string; targetText: string; sourceLang: string; targetLang: string }>('/translation/translate', {
              sourceText: transcript,
              sourceLang: sourceLangRef.current,
              targetLang: targetLangRef.current,
            })
            .then((data) => {
              if (data?.targetText?.trim()) {
                setResult(data);
                speakText(data.targetText.trim(), targetLangRef.current);
              }
            })
            .catch(() => toast.error(t('translation.errorTranslate')));
        }
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return (
    <div className="rd-page translation-page">
      <div className="translation-page__main rd-premium-panel">
        <div className="rd-panel-header">
          <h1>{t('translation.title')}</h1>
          <p className="rd-text-muted" style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
            {t('translation.voiceToVoice')}: {t('translation.voiceToText')}, {t('translation.autoLanguage')}, speak translation. {t('translation.liveModeHint')}
          </p>
        </div>

        <div className="translation-page__form">
          <div className="translation-page__row translation-page__row--live">
            <label className="translation-page__live-label">
              <input
                type="checkbox"
                checked={liveMode}
                onChange={(e) => setLiveMode(e.target.checked)}
                aria-label={t('translation.liveMode')}
              />
              <span>{t('translation.liveMode')}</span>
            </label>
            <label className="translation-page__live-label">
              <input
                type="checkbox"
                checked={liveVoiceToVoice}
                onChange={(e) => setLiveVoiceToVoice(e.target.checked)}
                aria-label={t('translation.liveVoiceToVoice')}
              />
              <span title={t('translation.liveVoiceToVoiceHint')}>{t('translation.liveVoiceToVoice')}</span>
            </label>
          </div>
          <div className="translation-page__row">
            <label className="translation-page__label">{t('translation.sourceLanguage')}</label>
            <select
              className="rd-input translation-page__select"
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              aria-label={t('translation.sourceLanguage')}
            >
              {LANG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="translation-page__row">
            <label className="translation-page__label">{t('translation.targetLanguage')}</label>
            <select
              className="rd-input translation-page__select"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              aria-label={t('translation.targetLanguage')}
            >
              {TARGET_LANGS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="translation-page__row">
            <div className="translation-page__input-wrap">
              <textarea
                className="rd-input translation-page__textarea"
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder={t('translation.sourcePlaceholder')}
                rows={4}
                disabled={listening}
                aria-label={t('translation.sourcePlaceholder')}
              />
              <button
                type="button"
                className={`rd-btn translation-page__voice-btn ${listening ? 'rd-btn-primary' : 'rd-btn-secondary'}`}
                onClick={startVoiceInput}
                title={listening ? (liveVoiceToVoice ? t('translation.stopLiveVoice') : t('translation.stopVoice')) : (liveVoiceToVoice ? t('translation.liveVoiceToVoiceHint') : t('translation.startVoice'))}
                aria-label={listening ? (liveVoiceToVoice ? t('translation.stopLiveVoice') : t('translation.stopVoice')) : (liveVoiceToVoice ? t('translation.startLiveVoice') : t('translation.startVoice'))}
              >
                {listening ? (liveVoiceToVoice ? t('translation.stopLiveVoice') : t('translation.stopVoice')) : '🎤'} {listening ? t('translation.listening') : (liveVoiceToVoice ? t('translation.startLiveVoice') : t('translation.startVoice'))}
              </button>
            </div>
          </div>
          <div className="translation-page__row">
            <button
              type="button"
              className="rd-btn rd-btn-primary translation-page__translate-btn"
              onClick={handleTranslate}
              disabled={loading || !sourceText.trim()}
            >
              {loading ? '…' : t('translation.translate')}
            </button>
          </div>
          {result && (
            <div className="translation-page__result">
              <div className="translation-page__result-header">
                <h3 className="translation-page__result-title">{t('translation.result')}</h3>
                {typeof window !== 'undefined' && window.speechSynthesis && (result.targetText || result.sourceText)?.trim() && (
                  <button
                    type="button"
                    className={`rd-btn rd-btn--small ${speaking ? 'rd-btn-primary' : 'rd-btn-secondary'}`}
                    onClick={speakTranslation}
                    title={t('translation.speakTranslation')}
                    aria-label={t('translation.speakTranslation')}
                  >
                    {speaking ? '⏹' : '🔊'} {speaking ? t('translation.stopVoice') : t('translation.speakTranslation')}
                  </button>
                )}
              </div>
              <div className="translation-page__result-text">{result.targetText || result.sourceText}</div>
            </div>
          )}
        </div>
      </div>

      <div className="translation-page__history rd-premium-panel">
        <h2 className="rd-panel-header" style={{ marginBottom: '0.75rem' }}>
          {t('translation.history')}
        </h2>
        {historyLoading ? (
          <p className="rd-text-muted">{t('costControl.loading')}</p>
        ) : history.length === 0 ? (
          <p className="rd-text-muted">{t('translation.noHistory')}</p>
        ) : (
          <ul className="translation-page__history-list">
            {history.map((item) => (
              <li key={item.id} className="translation-page__history-item">
                <div className="translation-page__history-source">{item.sourceText}</div>
                <div className="translation-page__history-target">{item.targetText}</div>
                <div className="translation-page__history-meta">
                  {item.sourceLang} → {item.targetLang}
                  {item.createdAt && (
                    <span>
                      {' · '}
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
