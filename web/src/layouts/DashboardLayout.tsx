import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import { getAllowedNavItems, canAccessPath } from '../config/roles';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const nav = getAllowedNavItems(user?.role ?? null);

  if (!canAccessPath(user?.role ?? null, location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="dashboard-layout">
      <header className="dashboard-layout__header">
        <div className="dashboard-layout__brand">
          <span className="brand-name">{t('app.name')}</span>
          <span className="brand-tagline">{t('app.tagline')} <span className="app-version">v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0'}</span></span>
        </div>
        <nav className="dashboard-layout__nav">
          {nav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={location.pathname === item.path ? 'active' : ''}
            >
              {t('nav.' + item.key)}
            </Link>
          ))}
        </nav>
        <div className="dashboard-layout__right">
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="rd-input lang-select"
          >
            <option value="en">EN</option>
            <option value="ru">RU</option>
            <option value="ka">KA</option>
          </select>
          <span className="user-email">{user?.nickname ?? ''}</span>
          <button type="button" className="rd-btn rd-btn-danger" onClick={clearAuth}>
            {t('auth.logout')}
          </button>
        </div>
      </header>
      <main className="dashboard-layout__main">
        <Outlet />
      </main>
    </div>
  );
}
