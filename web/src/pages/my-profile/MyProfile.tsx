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

      <div className="my-profile-page__grid">
        <section className="my-profile-page__section rd-premium-panel">
          <h2>{t('dashboard.driverInfo')}</h2>
          <div className="my-profile-stats">
            <div className="my-profile-stat-row">
              <span className="my-profile-stat-row__label">{t('auth.nickname')}</span>
              <span className="my-profile-stat-row__value">{user?.nickname ?? '—'}</span>
            </div>
            <div className="my-profile-stat-row">
              <span className="my-profile-stat-row__label">{t('auth.phone')}</span>
              <span className="my-profile-stat-row__value">{user?.phone ?? '—'}</span>
            </div>
            <div className="my-profile-stat-row">
              <span className="my-profile-stat-row__label">{t('auth.carType')}</span>
              <span className="my-profile-stat-row__value">
                {user?.carType ? t('auth.carType_' + user.carType) : '—'}
              </span>
            </div>
            <div className="my-profile-stat-row">
              <span className="my-profile-stat-row__label">{t('auth.carPlateNumber')}</span>
              <span className="my-profile-stat-row__value">{user?.carPlateNumber ?? '—'}</span>
            </div>
            <div className="my-profile-stat-row">
              <span className="my-profile-stat-row__label">{t('drivers.driverId')}</span>
              <span className="my-profile-stat-row__value">{user?.driverId ?? '—'}</span>
            </div>
            <div className="my-profile-stat-row">
              <span className="my-profile-stat-row__label">{t('drivers.carId')}</span>
              <span className="my-profile-stat-row__value">{user?.carId ?? '—'}</span>
            </div>
          </div>
        </section>

        <section className="my-profile-page__section rd-premium-panel">
          <h2>{t('dashboard.driverStats')}</h2>
          <div className="my-profile-stats">
            <div className="my-profile-stat-row">
              <span className="my-profile-stat-row__label">{t('dashboard.totalEarned')}</span>
              <span className="my-profile-stat-row__value">
                {driverStats != null
                  ? `$${(driverStats.totalEarningsCents / 100).toFixed(2)}`
                  : '—'}
              </span>
            </div>
            <div className="my-profile-stat-row">
              <span className="my-profile-stat-row__label">{t('dashboard.totalMiles')}</span>
              <span className="my-profile-stat-row__value">
                {driverStats != null ? driverStats.totalMiles.toFixed(1) : '—'}
              </span>
            </div>
          </div>
        </section>

        <section className="my-profile-page__section rd-premium-panel my-profile-page__section--full">
          <h2>{t('nav.about')}</h2>
          <p className="rd-text-muted">
            {t('about.description')}
          </p>
          <Link to="/about" className="rd-btn rd-btn-secondary my-profile-page__about-link">
            {t('about.learnMore')}
          </Link>
        </section>
      </div>

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
