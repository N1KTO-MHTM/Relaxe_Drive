import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import { useSocket } from '../ws/useSocket';
import { api } from '../api/client';
import { themeStore } from '../store/theme';
import type { Role } from '../store/auth';
import { getAllowedNavItems, canAccessPath } from '../config/roles';
import { ShowAsDriverProvider, useShowAsDriver } from '../contexts/ShowAsDriverContext';
import Toast from '../components/Toast';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const { i18n } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !user?.id) return;
    const onUserUpdated = (data: { userId?: string }) => {
      if (data?.userId === user.id) {
        api
          .get<{
            id: string;
            nickname: string;
            role: string;
            locale: string;
            available?: boolean;
            email?: string;
            phone?: string;
            driverId?: string;
            carId?: string;
            carType?: string;
            carPlateNumber?: string;
            carCapacity?: number;
            carModelAndYear?: string;
          }>('/users/me')
          .then((data) =>
            setUser(data ? { ...data, role: data.role as import('../store/auth').Role } : null),
          )
          .catch(() => {});
      }
    };
    socket.on('user.updated', onUserUpdated);
    return () => {
      socket.off('user.updated', onUserUpdated);
    };
  }, [socket, user?.id, setUser]);

  const nav = getAllowedNavItems(user?.role ?? null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setThemeState] = useState(themeStore.getTheme());

  // Group logic (not used for driver: driver gets direct tab links)
  const groups = {
    operations: [] as typeof nav,
    dispatch: [] as typeof nav,
    information: [] as typeof nav,
    driverSupport: [] as typeof nav,
    system: [] as typeof nav,
  };
  nav.forEach((item) => {
    if (item.group && groups[item.group as keyof typeof groups])
      groups[item.group as keyof typeof groups].push(item);
    else groups.operations.push(item);
  });

  // Determine potentially active groups (groups that have items)
  const availableGroups = Object.entries(groups).filter(([_, items]) => items.length > 0);

  // Find current active group based on URL
  const findCurrentGroup = () => {
    for (const [key, items] of availableGroups) {
      if (
        items.some(
          (item: { path: string }) =>
            location.pathname === item.path || location.pathname.startsWith(item.path + '/'),
        )
      ) {
        return key;
      }
    }
    return availableGroups[0]?.[0] || 'operations';
  };

  const [activeGroup, setActiveGroup] = useState<string>(() => findCurrentGroup());

  // Sync active group when location changes (in case user navigates via other means)
  useEffect(() => {
    const current = findCurrentGroup();
    if (current && current !== activeGroup) {
      setActiveGroup(current);
    }
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const unsub = themeStore.subscribe(setThemeState);
    return () => {
      unsub();
    };
  }, []);

  if (!canAccessPath(user?.role ?? null, location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <ShowAsDriverProvider>
      <DashboardLayoutInner
        nav={nav}
        availableGroups={availableGroups}
        activeGroup={activeGroup}
        setActiveGroup={setActiveGroup}
        activeSubItems={groups[activeGroup as keyof typeof groups] || []}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
        theme={theme}
        user={user}
        setUser={setUser}
        clearAuth={clearAuth}
        i18n={i18n}
        location={location}
      />
    </ShowAsDriverProvider>
  );
}

function DashboardLayoutInner({
  nav,
  availableGroups,
  activeGroup,
  setActiveGroup,
  activeSubItems,
  mobileNavOpen,
  setMobileNavOpen,
  theme,
  user,
  setUser,
  clearAuth,
  i18n,
  location,
}: {
  nav: ReturnType<typeof getAllowedNavItems>;
  availableGroups: [string, typeof nav][];
  activeGroup: string;
  setActiveGroup: (v: string) => void;
  activeSubItems: typeof nav;
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
  theme: string;
  user: import('../store/auth').User | null;
  setUser: (u: import('../store/auth').User | null) => void;
  clearAuth: () => void;
  i18n: { language: string; changeLanguage: (lng: string) => void };
  location: { pathname: string };
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showAsDriverCtx = useShowAsDriver();
  const _isDriver = user?.role === 'DRIVER';
  const canShowAsDriver = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';
  const effectiveIsDriver = _isDriver || (canShowAsDriver && (showAsDriverCtx?.showAsDriver ?? false));

  const navForDisplay = effectiveIsDriver ? getAllowedNavItems('DRIVER') : nav;
  const activeSubItemsResolved = effectiveIsDriver ? navForDisplay : activeSubItems;

  return (
    <div
      className={`dashboard-layout ${effectiveIsDriver ? 'dashboard-layout--driver-app' : ''}`}
    >
      <header className="dashboard-layout__header">
        <div className="dashboard-layout__brand-row">
          <button
            type="button"
            className="dashboard-layout__menu-btn"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label={mobileNavOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          >
            {mobileNavOpen ? '✕' : '☰'}
          </button>
          <div className="dashboard-layout__brand">
            <span className="brand-name">{t('app.name')}</span>
            <span className="brand-tagline">
              {t('app.tagline')}{' '}
              <span className="app-version">
                v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0'}
              </span>
            </span>
          </div>
        </div>

        {/* Desktop Two-Tier Nav (hidden for driver-app: we use bottom tab bar) */}
        {!effectiveIsDriver && (
        <nav
          className={`dashboard-layout__nav ${mobileNavOpen ? 'dashboard-layout__nav--open' : ''}`}
        >
            <>
              {/* Top Tier: Groups */}
              <div className="dashboard-layout__tabs">
                {availableGroups.map(([key, _]) => (
                  <button
                    key={key}
                    type="button"
                    className={`dashboard-layout__tab ${activeGroup === key ? 'dashboard-layout__tab--active' : ''}`}
                    onClick={() => setActiveGroup(key)}
                  >
                    {t(`nav.group.${key}`) || key.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Bottom Tier: Sub-items + Language (EN RU KA ES) */}
              <div className="dashboard-layout__sub-nav-container">
                <div className="dashboard-layout__sub-nav">
                  {activeSubItemsResolved.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`dashboard-layout__sub-link ${location.pathname === item.path ? 'dashboard-layout__sub-link--active' : ''}`}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      {t('nav.' + item.key)}
                    </Link>
                  ))}
                </div>
                <select
                  value={i18n.language}
                  aria-label={t('nav.language') || 'Language'}
                  onChange={(e) => {
                    const lng = e.target.value;
                    i18n.changeLanguage(lng);
                    const uid = user?.id;
                    if (uid) {
                      api
                        .patch<{ id: string; nickname: string; role: string; locale: string }>(
                          '/users/me',
                          { locale: lng },
                        )
                        .then((data) => setUser(data ? { ...data, role: data.role as Role } : null))
                        .catch(() => {});
                    }
                  }}
                  className="rd-input lang-select dashboard-layout__lang-select"
                >
                  <option value="en">EN</option>
                  <option value="ru">RU</option>
                  <option value="ka">KA</option>
                  <option value="es">ES</option>
                </select>
              </div>
            </>
        </nav>
        )}

        <div className="dashboard-layout__right">
          {canShowAsDriver && typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
            <button
              type="button"
              className={`rd-btn ${showAsDriverCtx?.showAsDriver ? 'rd-btn-primary' : 'rd-btn-secondary'} dashboard-layout__show-as-driver`}
              onClick={() => {
                const next = !showAsDriverCtx?.showAsDriver;
                showAsDriverCtx?.setShowAsDriver(next);
                setMobileNavOpen(false);
                if (next) navigate('/dashboard');
              }}
              title={showAsDriverCtx?.showAsDriver ? t('nav.backToDispatcher') : t('nav.showAsDriver')}
            >
              {showAsDriverCtx?.showAsDriver ? t('nav.backToDispatcher') : t('nav.showAsDriver')}
            </button>
          )}
          <button
            type="button"
            className="rd-btn theme-toggle"
            onClick={() => themeStore.setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={
              theme === 'dark'
                ? t('nav.themeLight') || 'Light theme'
                : t('nav.themeDark') || 'Dark theme'
            }
            title={theme === 'dark' ? t('nav.themeLight') || 'Light' : t('nav.themeDark') || 'Dark'}
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
          {effectiveIsDriver && (
            <select
              value={i18n.language}
              aria-label={t('nav.language') || 'Language'}
              onChange={(e) => {
                const lng = e.target.value;
                i18n.changeLanguage(lng);
                const uid = user?.id;
                if (uid) {
                  api
                    .patch<{ id: string; nickname: string; role: string; locale: string }>(
                      '/users/me',
                      { locale: lng },
                    )
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
          )}
          <span className="user-role-badge rd-badge">
            {user?.role ? t('roles.' + user.role.toLowerCase()) : ''}
          </span>
          <span className="user-info">
            {[user?.nickname, user?.phone, user?.email].filter((o): o is string => Boolean(o)).join(' • ') || ''}
          </span>
          {!effectiveIsDriver && (
            <button
              type="button"
              className="rd-btn rd-btn-danger"
              onClick={clearAuth}
              aria-label={t('auth.logout')}
            >
              {t('auth.logout')}
            </button>
          )}
        </div>
      </header>
      <main className="dashboard-layout__main">
        <Outlet />
      </main>

      {/* Driver app: fixed bottom tab bar (mobile-app style) */}
      {effectiveIsDriver && (
        <nav
          className="driver-app-tab-bar"
          role="tablist"
          aria-label={t('nav.myTrips')}
        >
          {navForDisplay.map((item) => {
            const isActive = location.pathname === item.path;
            const label =
              item.path === '/dashboard'
                ? t('nav.myTrips')
                : t('nav.' + item.key);
            const icon =
              item.path === '/dashboard' ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 17h14v-5H5v5zM5 8h14V6a2 2 0 00-2-2H7a2 2 0 00-2 2v2z" />
                  <circle cx="7.5" cy="16.5" r="1.5" />
                  <circle cx="16.5" cy="16.5" r="1.5" />
                </svg>
              ) : item.path === '/translation' ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
              ) : item.path === '/chat' ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                </svg>
              );
            return (
              <Link
                key={item.path}
                to={item.path}
                role="tab"
                aria-selected={isActive}
                className={`driver-app-tab-bar__item ${isActive ? 'driver-app-tab-bar__item--active' : ''}`}
                onClick={() => setMobileNavOpen(false)}
              >
                <span className="driver-app-tab-bar__icon">{icon}</span>
                <span className="driver-app-tab-bar__label">{label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      <Toast />
    </div>
  );
}
