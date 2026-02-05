import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';

const LANGS = [{ code: 'en', label: 'EN' }, { code: 'ru', label: 'RU' }, { code: 'ka', label: 'KA' }] as const;

type DesktopLayoutProps = { children: React.ReactNode; fullHeight?: boolean };

export default function DesktopLayout({ children, fullHeight }: DesktopLayoutProps) {
  const { t, i18n } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`desktop-layout ${fullHeight ? 'desktop-layout--full' : ''}`}>
      <header className="rd-desktop-nav">
        <nav className="rd-desktop-nav__tabs">
          <NavLink to="/control" className={({ isActive }) => `rd-desktop-nav__tab ${isActive ? 'rd-desktop-nav__tab--active' : ''}`}>
            {t('modes.control')}
          </NavLink>
          <NavLink to="/wall" className={({ isActive }) => `rd-desktop-nav__tab ${isActive ? 'rd-desktop-nav__tab--active' : ''}`}>
            {t('modes.wall')}
          </NavLink>
          <NavLink to="/health" className={({ isActive }) => `rd-desktop-nav__tab ${isActive ? 'rd-desktop-nav__tab--active' : ''}`}>
            {t('modes.health')}
          </NavLink>
          <NavLink to="/logs" className={({ isActive }) => `rd-desktop-nav__tab ${isActive ? 'rd-desktop-nav__tab--active' : ''}`}>
            {t('modes.logs')}
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => `rd-desktop-nav__tab ${isActive ? 'rd-desktop-nav__tab--active' : ''}`}>
            {t('about.title')}
          </NavLink>
        </nav>
        <div className="rd-desktop-nav__lang">
          {LANGS.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              className={`rd-desktop-nav__lang-btn ${i18n.language === code ? 'rd-desktop-nav__lang-btn--active' : ''}`}
              onClick={() => i18n.changeLanguage(code)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="rd-desktop-nav__version">v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0'}</span>
        <button type="button" className="rd-desktop-nav__logout rd-btn" onClick={handleLogout}>
          {t('auth.logout')}
        </button>
      </header>
      <main className="rd-desktop-nav__content">{children}</main>
    </div>
  );
}
