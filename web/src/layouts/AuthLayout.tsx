import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './AuthLayout.css';

export default function AuthLayout() {
  const { t, i18n } = useTranslation();
  const current = (i18n.language || 'en').split('-')[0];
  const lngs = [
    { code: 'en', label: 'EN' },
    { code: 'ru', label: 'RU' },
    { code: 'ka', label: 'KA' },
    { code: 'es', label: 'ES' },
  ];

  const renderLang = () => (
    <div className="auth-layout__lang" role="group" aria-label={t('nav.language') || 'Language'}>
      <span className="auth-layout__lang-label">{t('nav.language') || 'Language'}</span>
      {lngs.map((l) => (
        <button
          key={l.code}
          type="button"
          className={current === l.code ? 'active' : ''}
          onClick={() => i18n.changeLanguage(l.code)}
          title={l.label}
          lang="en"
        >
          {l.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="auth-layout">
      <div className="auth-layout__lang-wrap auth-layout__lang-wrap--top">{renderLang()}</div>
      <div className="auth-layout__center rd-premium-panel">
        <div className="auth-layout__lang-wrap auth-layout__lang-wrap--in-card">{renderLang()}</div>
        <Outlet />
      </div>
      <div className="auth-layout__version">
        v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0'}
      </div>
    </div>
  );
}
