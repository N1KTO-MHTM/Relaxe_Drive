import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { getAllowedDesktopNavItems, canAccessDesktopPath } from '../config/roles';

const LANGS = [{ code: 'en', label: 'EN' }, { code: 'ru', label: 'RU' }, { code: 'ka', label: 'KA' }, { code: 'es', label: 'ES' }] as const;

type DesktopLayoutProps = { children: React.ReactNode; fullHeight?: boolean };

export default function DesktopLayout({ children, fullHeight }: DesktopLayoutProps) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = getAllowedDesktopNavItems(user?.role ?? null);

  useEffect(() => {
    if (!user?.role) return;
    if (!canAccessDesktopPath(user.role, location.pathname)) {
      const allowed = getAllowedDesktopNavItems(user.role);
      if (allowed.length) navigate(allowed[0].path, { replace: true });
    }
  }, [user?.role, location.pathname, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`desktop-layout ${fullHeight ? 'desktop-layout--full' : ''}`}>
      <header className="rd-desktop-nav">
        <nav className="rd-desktop-nav__tabs">
          {navItems.map(({ path, key }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `rd-desktop-nav__tab ${isActive ? 'rd-desktop-nav__tab--active' : ''}`}
            >
              {t(key)}
            </NavLink>
          ))}
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
