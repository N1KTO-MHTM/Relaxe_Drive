import { useTranslation } from 'react-i18next';
import './About.css';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0';

export default function About() {
  const { t } = useTranslation();
  return (
    <div className="about-page rd-panel">
      <h1>{t('about.title')}</h1>
      <div className="about-block">
        <p className="about-app">{t('about.app')} — {t('app.tagline')}</p>
        <p className="about-version">{t('about.version')}: v{APP_VERSION}</p>
        <p className="about-creator">{t('about.creator')}: <strong>N1KTO</strong></p>
      </div>
      <p className="rd-text-muted">{t('about.description')}</p>
    </div>
  );
}
