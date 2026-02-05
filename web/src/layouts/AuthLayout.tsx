import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './AuthLayout.css';

export default function AuthLayout() {
  const { i18n } = useTranslation();
  const lngs = [
    { code: 'en', label: 'EN' },
    { code: 'ru', label: 'RU' },
    { code: 'ka', label: 'KA' },
    { code: 'es', label: 'ES' },
  ];

  return (
    <div className="auth-layout">
      <div className="auth-layout__lang">
        {lngs.map((l) => (
          <button
            key={l.code}
            type="button"
            className={i18n.language === l.code ? 'active' : ''}
            onClick={() => i18n.changeLanguage(l.code)}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="auth-layout__center rd-panel">
        <Outlet />
      </div>
      <div className="auth-layout__version">
        v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0'}
      </div>
    </div>
  );
}
