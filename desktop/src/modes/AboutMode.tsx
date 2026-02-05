import { useTranslation } from 'react-i18next';
import DesktopLayout from '../layouts/DesktopLayout';
import { useAuthStore } from '../store/auth';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0';

export default function AboutMode() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? null;

  function AccessBlock() {
    if (role === 'DRIVER') {
      return (
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--rd-bg-panel)', borderRadius: 'var(--rd-radius)', border: '1px solid var(--rd-border)' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600 }}>{t('about.yourAccess')} — {t('about.roleDriver')}</h2>
          <p className="rd-text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>{t('about.driverAccess')}</p>
          <p className="rd-text-muted" style={{ marginTop: '0.5rem', fontSize: '0.8125rem', lineHeight: 1.5 }}>{t('about.driverDetail')}</p>
        </div>
      );
    }
    if (role === 'DISPATCHER') {
      return (
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--rd-bg-panel)', borderRadius: 'var(--rd-radius)', border: '1px solid var(--rd-border)' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600 }}>{t('about.yourAccess')} — {t('about.roleDispatcher')}</h2>
          <p className="rd-text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>{t('about.dispatcherAccess')}</p>
          <p className="rd-text-muted" style={{ marginTop: '0.5rem', fontSize: '0.8125rem', lineHeight: 1.5 }}>{t('about.dispatcherDetail')}</p>
        </div>
      );
    }
    if (role === 'ADMIN') {
      return (
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--rd-bg-panel)', borderRadius: 'var(--rd-radius)', border: '1px solid var(--rd-border)' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600 }}>{t('about.yourAccess')} — {t('about.roleAdmin')}</h2>
          <p className="rd-text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>{t('about.adminAccess')}</p>
        </div>
      );
    }
    return null;
  }

  return (
    <DesktopLayout>
      <div className="rd-panel" style={{ maxWidth: 480 }}>
        <h1>{t('about.title')}</h1>
        <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'var(--rd-bg-elevated)', borderRadius: 'var(--rd-radius)', border: '1px solid var(--rd-border)' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '1.0625rem' }}>{t('about.app')} — {t('app.tagline')}</p>
          <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--rd-text-muted)' }}>{t('about.version')}: v{APP_VERSION}</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9375rem' }}>{t('about.creator')}: <strong style={{ color: 'var(--rd-accent)' }}>N1KTO</strong></p>
        </div>
        {role && <AccessBlock />}
        <p className="rd-text-muted" style={{ marginTop: '1rem', fontSize: '0.875rem' }}>{t('about.description')}</p>
      </div>
    </DesktopLayout>
  );
}
