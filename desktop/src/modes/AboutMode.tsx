import { useTranslation } from 'react-i18next';
import DesktopLayout from '../layouts/DesktopLayout';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0';

export default function AboutMode() {
  const { t } = useTranslation();
  return (
    <DesktopLayout>
      <div className="rd-panel" style={{ maxWidth: 480 }}>
        <h1>{t('about.title')}</h1>
        <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'var(--rd-bg-elevated)', borderRadius: 'var(--rd-radius)', border: '1px solid var(--rd-border)' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '1.0625rem' }}>{t('about.app')} — {t('app.tagline')}</p>
          <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--rd-text-muted)' }}>{t('about.version')}: v{APP_VERSION}</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9375rem' }}>{t('about.creator')}: <strong style={{ color: 'var(--rd-accent)' }}>N1KTO</strong></p>
        </div>
        <p className="rd-text-muted" style={{ marginTop: '1rem', fontSize: '0.875rem' }}>{t('about.description')}</p>
      </div>
    </DesktopLayout>
  );
}
