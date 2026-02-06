import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import { useSocket } from '../ws/useSocket';
import { api } from '../api/client';
import { themeStore } from '../store/theme';
import type { Role } from '../store/auth';
import { getAllowedNavItems, canAccessPath } from '../config/roles';
import Toast from '../components/Toast';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !user?.id) return;
    const onUserUpdated = (data: { userId?: string }) => {
      if (data?.userId === user.id) {
        api.get<{ id: string; nickname: string; role: string; locale: string; available?: boolean; email?: string; phone?: string; driverId?: string; carType?: string; carPlateNumber?: string; carCapacity?: number; carModelAndYear?: string }>('/users/me').then((data) => setUser(data ? { ...data, role: data.role as import('../store/auth').Role } : null)).catch(() => {});
      }
    };
    socket.on('user.updated', onUserUpdated);
    return () => { socket.off('user.updated', onUserUpdated); };
  }, [socket, user?.id, setUser]);

  const nav = getAllowedNavItems(user?.role ?? null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setThemeState] = useState(themeStore.getTheme());
  useEffect(() => {
    const unsub = themeStore.subscribe(setThemeState);
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  if (!canAccessPath(user?.role ?? null, location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="dashboard-layout">
      <header className="dashboard-layout__header">
        <div className="dashboard-layout__brand-row">
          <button
            type="button"
            className="dashboard-layout__menu-btn"
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-label={mobileNavOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          >
            {mobileNavOpen ? '✕' : '☰'}
          </button>
          <div className="dashboard-layout__brand">
            <span className="brand-name">{t('app.name')}</span>
            <span className="brand-tagline">{t('app.tagline')} <span className="app-version">v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0'}</span></span>
          </div>
        </div>
        <nav className={`dashboard-layout__nav ${mobileNavOpen ? 'dashboard-layout__nav--open' : ''}`}>
          {nav.map((item, index) => {
            const prevGroup = nav[index - 1]?.group;
            const showSep = item.group && prevGroup && item.group !== prevGroup;
            return (
              <span key={item.path} className="dashboard-layout__nav-item-wrap">
                {showSep && <span className="dashboard-layout__nav-sep" aria-hidden />}
                <Link
                  to={item.path}
                  className={location.pathname === item.path ? 'active' : ''}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {item.path === '/dashboard' && user?.role === 'DRIVER' ? t('nav.myTrips') : t('nav.' + item.key)}
                </Link>
              </span>
            );
          })}
        </nav>
        <div className="dashboard-layout__right">
          {(user?.role === 'ADMIN' || user?.role === 'DISPATCHER') && (
            <Link to="/dashboard" state={{ openForm: true }} className="rd-btn rd-btn-primary dashboard-layout__new-order">
              + {t('nav.newOrder')}
            </Link>
          )}
          <button
            type="button"
            className="rd-btn theme-toggle"
            onClick={() => themeStore.setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? (t('nav.themeLight') || 'Light theme') : (t('nav.themeDark') || 'Dark theme')}
            title={theme === 'dark' ? (t('nav.themeLight') || 'Light') : (t('nav.themeDark') || 'Dark')}
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
          <select
            value={i18n.language}
            aria-label={t('nav.language') || 'Language'}
            onChange={(e) => {
              const lng = e.target.value;
              i18n.changeLanguage(lng);
              const uid = user?.id;
              if (uid) {
                api.patch<{ id: string; nickname: string; role: string; locale: string }>('/users/me', { locale: lng })
                  .then((data) => setUser(data ? { ...data, role: data.role as Role } : null))
                  .catch(() => {});
              }
            }}
            className="rd-input lang-select"
          >
            <option value="en">EN</option>
            <option value="ru">RU</option>
            <option value="ka">KA</option>
            <option value="es">ES</option>
          </select>
          <span className="user-role-badge rd-badge">{user?.role ? t('roles.' + user.role.toLowerCase()) : ''}</span>
          <span className="user-info">
            {[user?.nickname, user?.phone, user?.email].filter(Boolean).join(' • ') || ''}
          </span>
          <button type="button" className="rd-btn rd-btn-danger" onClick={clearAuth} aria-label={t('auth.logout')}>
            {t('auth.logout')}
          </button>
        </div>
      </header>
      <main className="dashboard-layout__main">
        <Outlet />
      </main>
      <Toast />
    </div>
  );
}
