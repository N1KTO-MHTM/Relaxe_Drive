/**
 * Why phone and PC can show different versions:
 * - The app is a PWA: the service worker and the browser cache JS/CSS.
 * - After a new deploy, the phone may still be running the old cached app until
 *   the user reloads or the cache updates. PC might have been refreshed already.
 * This component checks for a new version (different index.html script hash) and
 * prompts the user to reload so both devices get the same build.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from '../i18n';

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const CHECK_ON_VISIBLE = true;

function getCurrentScriptHash(): string | null {
  if (typeof document === 'undefined') return null;
  const scripts = document.querySelectorAll('script[src]');
  for (const s of scripts) {
    const src = (s as HTMLScriptElement).src;
    const m = src.match(/\/assets\/[^?]+/);
    if (m) return m[0];
  }
  return null;
}

export default function NewVersionPrompt() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const currentHash = getCurrentScriptHash();

  useEffect(() => {
    if (!currentHash) return;

    const check = async () => {
      try {
        const res = await fetch(`${window.location.origin}/index.html?t=${Date.now()}`, { cache: 'no-store', method: 'GET' });
        const html = await res.text();
        const match = html.match(/\/assets\/[a-zA-Z0-9_-]+\.js/);
        const serverHash = match ? match[0] : null;
        if (serverHash && serverHash !== currentHash) {
          setShow(true);
        }
      } catch {
        // ignore
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    check();
    const tId = setInterval(check, CHECK_INTERVAL_MS);
    if (CHECK_ON_VISIBLE && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
    }
    return () => {
      clearInterval(tId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentHash]);

  if (!show) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        right: '1rem',
        maxWidth: '24rem',
        margin: '0 auto',
        padding: '0.75rem 1rem',
        background: 'var(--rd-premium-card)',
        border: '1px solid var(--rd-accent)',
        borderRadius: 'var(--rd-radius-lg)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: '0.875rem' }}>{t('newVersion.available')}</span>
      <button
        type="button"
        className="rd-btn rd-btn-primary"
        style={{ flexShrink: 0 }}
        onClick={() => window.location.reload()}
      >
        {t('newVersion.reload')}
      </button>
    </div>
  );
}
