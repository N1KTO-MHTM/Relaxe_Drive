import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth';
import './About.css';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0';

export default function About() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? null;

  function AccessBlock() {
    if (role === 'DRIVER') {
      return (
        <div className="about-access">
          <h2>{t('about.yourAccess')} — {t('about.roleDriver')}</h2>
          <p className="rd-text-muted">{t('about.driverAccess')}</p>
          <p className="rd-text-muted about-detail">{t('about.driverDetail')}</p>
        </div>
      );
    }
    if (role === 'DISPATCHER') {
      return (
        <div className="about-access">
          <h2>{t('about.yourAccess')} — {t('about.roleDispatcher')}</h2>
          <p className="rd-text-muted">{t('about.dispatcherAccess')}</p>
          <p className="rd-text-muted about-detail">{t('about.dispatcherDetail')}</p>
        </div>
      );
    }
    if (role === 'ADMIN') {
      return (
        <div className="about-access">
          <h2>{t('about.yourAccess')} — {t('about.roleAdmin')}</h2>
          <p className="rd-text-muted">{t('about.adminAccess')}</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="rd-page">
      <div className="about-page rd-panel">
        <h1>{t('about.title')}</h1>
        <div className="about-block">
          <p className="about-app">{t('about.app')} — {t('app.tagline')}</p>
          <p className="about-version">{t('about.version')}: v{APP_VERSION}</p>
          <p className="about-creator">{t('about.creator')}: <strong>N1KTO</strong></p>
        </div>
        {role && <AccessBlock />}
        <p className="rd-text-muted" style={{ marginTop: '1rem' }}>{t('about.description')}</p>
        <p className="rd-text-muted" style={{ marginTop: '0.75rem', fontWeight: 500 }}>{t('about.staffOnly')}</p>
      </div>
    </div>
  );
}
