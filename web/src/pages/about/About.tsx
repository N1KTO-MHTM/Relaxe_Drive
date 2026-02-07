import { useTranslation } from 'react-i18next';
import './About.css';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.3';

export default function About() {
  const { t } = useTranslation();

  return (
    <div className="rd-page">
      <div className="about-page">
        <header className="about-header rd-panel">
          <h1>{t('about.title')}</h1>
          <div className="about-hero">
            <p className="about-app">{t('about.app')} — <strong>{t('app.tagline')}</strong></p>
            <p className="about-version">{t('about.version')}: v{APP_VERSION}</p>
            <p className="about-creator">{t('about.creator')}: <strong>N1KTO</strong></p>
          </div>
          <p className="rd-text-muted about-main-desc">{t('about.description')}</p>
        </header>

        <section className="about-categories">
          <h2 className="categories-title">{t('about.categoriesTitle')}</h2>
          <div className="about-grid">
            {/* General System Info */}
            <div className="about-card rd-panel">
              <div className="about-card-icon">🏗️</div>
              <h3>{t('about.instructionsGeneralTitle')}</h3>
              <p className="rd-text-muted">{t('about.instructionsGeneral')}</p>
            </div>

            {/* Role-specific Guides */}
            <div className="about-card rd-panel">
              <div className="about-card-icon">🎧</div>
              <h3>{t('about.roleDispatcher')}</h3>
              <p className="rd-text-muted">{t('about.instructionsDispatcher')}</p>
            </div>

            <div className="about-card rd-panel">
              <div className="about-card-icon">🚗</div>
              <h3>{t('about.roleDriver')}</h3>
              <p className="rd-text-muted">{t('about.instructionsDriver')}</p>
            </div>

            <div className="about-card rd-panel">
              <div className="about-card-icon">🔐</div>
              <h3>{t('about.roleAdmin')}</h3>
              <p className="rd-text-muted">{t('about.instructionsAdmin')}</p>
            </div>

            {/* Location & Safety */}
            <div className="about-card rd-panel">
              <div className="about-card-icon">📍</div>
              <h3>{t('about.locationGuideTitle')}</h3>
              <div className="about-card-content">
                <p className="rd-text-muted">{t('about.locationGuideIntro')}</p>
                <ul className="about-step-list">
                  <li>{t('about.locationGuideStep1')}</li>
                  <li>{t('about.locationGuideStep2')}</li>
                  <li>{t('about.locationGuideStep3')}</li>
                </ul>
              </div>
            </div>

            <div className="about-card rd-panel">
              <div className="about-card-icon">📱</div>
              <h3>{t('about.locationGuidePhoneTitle')}</h3>
              <div className="about-card-content">
                <ul className="about-step-list">
                  <li>{t('about.locationGuidePhone1')}</li>
                  <li>{t('about.locationGuidePhone2')}</li>
                  <li>{t('about.locationGuidePhone3')}</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <footer className="about-footer rd-panel">
          <p className="rd-text-muted" style={{ fontWeight: 500 }}>{t('about.staffOnly')}</p>
        </footer>
      </div>
    </div>
  );
}
