/**
 * Translation page for drivers: uses Google Translate only.
 * The Google Translate widget is in the app header (top-right). This page directs
 * drivers to use it and optionally mounts a second instance in the content area.
 */
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement: {
          new (options: { pageLanguage: string; layout: number; autoDisplay: boolean }, elementId: string): void;
          InlineLayout: { SIMPLE: number };
        };
      };
    };
  }
}

export default function Translation() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = false;
    const mountWidget = () => {
      if (mounted || !containerRef.current) return;
      const g = window.google?.translate?.TranslateElement;
      if (!g || typeof g !== 'function') return;
      try {
        new window.google!.translate!.TranslateElement(
          {
            pageLanguage: 'en',
            layout: window.google!.translate!.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false,
          },
          'google_translate_element_page'
        );
        mounted = true;
      } catch {
        // ignore
      }
    };

    mountWidget();
    const t = setInterval(() => {
      mountWidget();
      if (mounted) clearInterval(t);
    }, 300);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rd-page">
      <div className="translation-page rd-premium-panel" style={{ maxWidth: 480, margin: '0 auto' }}>
        <h1>Translation</h1>
        <p className="rd-text-muted" style={{ marginBottom: '1rem' }}>
          Use Google Translate to view the app in your language. Select your language below or use the
          language selector (e.g. «EN») at the top right of the screen.
        </p>
        <div
          id="google_translate_element_page"
          ref={containerRef}
          style={{ minHeight: 40, marginTop: '0.5rem' }}
        />
      </div>
    </div>
  );
}
