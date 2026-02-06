import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import DesktopLayout from '../layouts/DesktopLayout';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';

/** Driver phones only for DISPATCHER and ADMIN. */
function canSeeDriverPhones(role: string | undefined) {
  return role === 'ADMIN' || role === 'DISPATCHER';
}

interface DriverRow {
  id: string;
  nickname: string;
  phone?: string | null;
  role: string;
  lat?: number | null;
  lng?: number | null;
  blocked?: boolean;
  bannedUntil?: string | null;
}

export default function DriversMode() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [list, setList] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const showPhone = canSeeDriverPhones(user?.role);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<DriverRow[]>('/users')
      .then((data) => setList(Array.isArray(data) ? data.filter((u) => u.role === 'DRIVER') : []))
      .catch(() => setError('Failed to load drivers'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <DesktopLayout>
      <div className="drivers-mode">
        <div className="rd-panel-header">
          <h1>{t('drivers.title')}</h1>
          <button type="button" className="rd-btn rd-btn-secondary" onClick={load} disabled={loading}>
            {t('common.refresh')}
          </button>
        </div>
        <p className="rd-text-muted" style={{ marginBottom: '1rem' }}>{t('drivers.subtitle')}</p>
        {error && <p className="rd-text-critical" style={{ marginBottom: '1rem' }}>{error}</p>}
        {loading && <p className="logs-mode__muted">{t('common.loading')}</p>}
        {!loading && list.length === 0 && <p className="logs-mode__muted">{t('drivers.noDrivers')}</p>}
        {!loading && list.length > 0 && (
          <div className="logs-mode__table-wrap">
            <table className="logs-mode__table">
              <thead>
                <tr>
                  <th>{t('drivers.nickname')}</th>
                  {showPhone && <th>{t('drivers.phone')}</th>}
                  <th>{t('drivers.status')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((d) => {
                  const hasLocation = d.lat != null && d.lng != null && Number.isFinite(d.lat) && Number.isFinite(d.lng);
                  const statusKey = d.blocked ? 'blocked' : d.bannedUntil && new Date(d.bannedUntil) > new Date() ? 'banned' : hasLocation ? 'onMap' : 'offline';
                  return (
                    <tr key={d.id}>
                      <td><strong>{d.nickname}</strong></td>
                      {showPhone && <td>{d.phone ?? '—'}</td>}
                      <td>
                        <span className={`rd-badge ${statusKey === 'onMap' ? 'rd-badge-ok' : statusKey === 'blocked' || statusKey === 'banned' ? 'rd-badge-critical' : ''}`}>
                          {t(`drivers.${statusKey}`)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DesktopLayout>
  );
}
