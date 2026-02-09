import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth';
import { api } from '../../api/client';
import './MyProfile.css';

export default function MyProfile() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [driverStats, setDriverStats] = useState<{
    totalEarningsCents: number;
    totalMiles: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ totalEarningsCents: number; totalMiles: number }>('/users/me/stats')
      .then((data) => {
        if (!cancelled)
          setDriverStats({
            totalEarningsCents: data.totalEarningsCents,
            totalMiles: data.totalMiles,
          });
      })
      .catch(() => {
        if (!cancelled) setDriverStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rd-page my-profile-page">
      <header className="my-profile-page__header">
        <h1>{t('dashboard.myProfileCategory')}</h1>
      </header>

      <section className="my-profile-page__section rd-premium-panel">
        <h2>{t('dashboard.driverInfo')}</h2>
        <div className="dashboard-stats-card">
          <div className="stat-row">
            <span>{t('auth.nickname')}</span>
            <span>{user?.nickname ?? '—'}</span>
          </div>
          <div className="stat-row">
            <span>{t('auth.phone')}</span>
            <span>{user?.phone ?? '—'}</span>
          </div>
          <div className="stat-row">
            <span>{t('auth.carType')}</span>
            <span>{user?.carType ? t('auth.carType_' + user.carType) : '—'}</span>
          </div>
          <div className="stat-row">
            <span>{t('auth.carPlateNumber')}</span>
            <span>{user?.carPlateNumber ?? '—'}</span>
          </div>
          <div className="stat-row">
            <span>{t('drivers.driverId')}</span>
            <span>{user?.driverId ?? '—'}</span>
          </div>
          <div className="stat-row">
            <span>{t('drivers.carId')}</span>
            <span>{user?.carId ?? '—'}</span>
          </div>
        </div>
      </section>

      <section className="my-profile-page__section rd-premium-panel">
        <h2>{t('dashboard.driverStats')}</h2>
        <div className="dashboard-stats-card">
          <div className="stat-row">
            <span>{t('dashboard.totalEarned')}</span>
            <span>
              {driverStats != null
                ? `$${(driverStats.totalEarningsCents / 100).toFixed(2)}`
                : '—'}
            </span>
          </div>
          <div className="stat-row">
            <span>{t('dashboard.totalMiles')}</span>
            <span>{driverStats != null ? driverStats.totalMiles.toFixed(1) : '—'}</span>
          </div>
        </div>
      </section>

      <section className="my-profile-page__section rd-premium-panel">
        <h2>{t('nav.about')}</h2>
        <p className="rd-text-muted" style={{ marginBottom: '1rem' }}>
          {t('about.description')}
        </p>
        <Link to="/about" className="rd-btn rd-btn-secondary">
          {t('nav.about')}
        </Link>
      </section>

      <section className="my-profile-page__section rd-premium-panel">
        <h2>{t('nav.driverReports')}</h2>
        <p className="rd-text-muted" style={{ marginBottom: '1rem' }}>
          {t('dashboard.driverReportsHint')}
        </p>
        <Link to="/driver-reports" className="rd-btn rd-btn-secondary">
          {t('nav.driverReports')}
        </Link>
      </section>

      <section className="my-profile-page__footer">
        <button
          type="button"
          className="rd-btn rd-btn-danger"
          onClick={() => useAuthStore.getState().clearAuth()}
          aria-label={t('auth.logout')}
        >
          {t('auth.logout')}
        </button>
      </section>
    </div>
  );
}
