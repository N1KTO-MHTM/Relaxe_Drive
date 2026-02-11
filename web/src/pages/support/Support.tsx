import { useTranslation } from '../../i18n';
import { Link } from 'react-router-dom';
import './Support.css';

export default function Support() {
  const { t } = useTranslation();

  return (
    <div className="rd-page">
      <div className="support-page rd-premium-panel">
        <h1>{t('support.title')}</h1>
        <p className="rd-text-muted support-page__intro">{t('support.intro')}</p>
        <div className="support-page__links">
          <Link to="/chat" className="support-page__card">
            <span className="support-page__icon support-page__icon--chat" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </span>
            <span className="support-page__label">{t('support.chat')}</span>
          </Link>
          <Link to="/statements" className="support-page__card">
            <span className="support-page__icon support-page__icon--statements" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
              </svg>
            </span>
            <span className="support-page__label">{t('support.statements')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
