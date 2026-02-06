import { useTranslation } from 'react-i18next';
import { useState, useEffect, useMemo } from 'react';
import DesktopLayout from '../layouts/DesktopLayout';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { downloadCsv } from '../utils/exportCsv';

const PAGE_SIZE = 20;

const CAR_TYPES = ['SEDAN', 'MINIVAN', 'SUV'] as const;
type CarTypeTab = 'ALL' | (typeof CAR_TYPES)[number] | 'OTHER';

/** Driver phones only for DISPATCHER and ADMIN. */
function canSeeDriverPhones(role: string | undefined) {
  return role === 'ADMIN' || role === 'DISPATCHER';
}

interface DriverRow {
  id: string;
  nickname: string;
  phone?: string | null;
  email?: string | null;
  role: string;
  lat?: number | null;
  lng?: number | null;
  blocked?: boolean;
  bannedUntil?: string | null;
  driverId?: string | null;
  carType?: string | null;
  carPlateNumber?: string | null;
  carCapacity?: number | null;
  carModelAndYear?: string | null;
}

function carTypeLabel(t: (key: string) => string, carType: string | null | undefined): string {
  if (!carType) return '—';
  const key = `auth.carType_${carType}`;
  const out = t(key);
  return out === key ? carType : out;
}

export default function DriversMode() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [list, setList] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [carTypeTab, setCarTypeTab] = useState<CarTypeTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const showPhone = canSeeDriverPhones(user?.role);

  const listByCarType = useMemo(() => {
    if (carTypeTab === 'ALL') return list;
    if (carTypeTab === 'OTHER') return list.filter((d) => !d.carType || !CAR_TYPES.includes(d.carType as (typeof CAR_TYPES)[number]));
    return list.filter((d) => d.carType === carTypeTab);
  }, [list, carTypeTab]);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return listByCarType;
    return listByCarType.filter(
      (d) =>
        (d.nickname ?? '').toLowerCase().includes(q) ||
        (d.phone ?? '').toLowerCase().includes(q) ||
        (d.email ?? '').toLowerCase().includes(q) ||
        (d.driverId ?? '').toLowerCase().includes(q)
    );
  }, [listByCarType, searchQuery]);

  const paginatedList = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredList.slice(start, start + PAGE_SIZE);
  }, [filteredList, page]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [searchQuery, carTypeTab]);

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
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              className="rd-input"
              placeholder={t('drivers.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 180 }}
            />
            <button type="button" className="rd-btn" onClick={() => downloadCsv(filteredList, 'drivers.csv', [
              { key: 'nickname', label: t('drivers.nickname') },
              { key: 'phone', label: t('drivers.phone') },
              { key: 'email', label: t('auth.email') },
              { key: 'driverId', label: t('drivers.driverId') },
              { key: 'carType', label: t('auth.carType') },
              { key: 'carPlateNumber', label: t('auth.carPlateNumber') },
            ])} disabled={filteredList.length === 0}>
              {t('drivers.exportCsv')}
            </button>
            <button type="button" className="rd-btn rd-btn-secondary" onClick={load} disabled={loading}>
              {t('common.refresh')}
            </button>
          </div>
        </div>
        <p className="rd-text-muted" style={{ marginBottom: '1rem' }}>{t('drivers.subtitle')}</p>
        {error && <p className="rd-text-critical" style={{ marginBottom: '1rem' }}>{error}</p>}
        {loading && <p className="logs-mode__muted">{t('common.loading')}</p>}
        {!loading && list.length > 0 && (
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(['ALL', 'SEDAN', 'MINIVAN', 'SUV', 'OTHER'] as CarTypeTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`rd-btn rd-btn-secondary ${carTypeTab === tab ? 'rd-btn-primary' : ''}`}
                onClick={() => setCarTypeTab(tab)}
              >
                {tab === 'ALL' ? t('drivers.tabAll') : tab === 'OTHER' ? t('drivers.tabOther') : t(`auth.carType_${tab}`)}
              </button>
            ))}
          </div>
        )}
        {!loading && list.length === 0 && <p className="logs-mode__muted">{t('drivers.noDrivers')}</p>}
        {!loading && filteredList.length === 0 && list.length > 0 && (
          <p className="logs-mode__muted">{t('drivers.noMatch')}</p>
        )}
        {!loading && filteredList.length > 0 && (
          <>
            <div className="logs-mode__table-wrap">
              <table className="logs-mode__table">
                <thead>
                  <tr>
                    <th>{t('drivers.nickname')}</th>
                    {showPhone && <th>{t('drivers.phone')}</th>}
                    <th>{t('drivers.driverId')}</th>
                    <th>{t('auth.carType')}</th>
                    <th>{t('auth.carPlateNumber')}</th>
                    <th>{t('drivers.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedList.map((d) => {
                  const hasLocation = d.lat != null && d.lng != null && Number.isFinite(d.lat) && Number.isFinite(d.lng);
                  const statusKey = d.blocked ? 'blocked' : d.bannedUntil && new Date(d.bannedUntil) > new Date() ? 'banned' : hasLocation ? 'onMap' : 'offline';
                  return (
                    <tr key={d.id}>
                      <td><strong>{d.nickname}</strong></td>
                      {showPhone && <td>{d.phone ?? '—'}</td>}
                      <td>{d.driverId ?? '—'}</td>
                      <td>{carTypeLabel(t, d.carType)}</td>
                      <td>{d.carPlateNumber ?? '—'}</td>
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
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="rd-btn rd-btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  ←
                </button>
                <span className="rd-text-muted">
                  {t('drivers.page')} {page} / {totalPages} ({filteredList.length})
                </span>
                <button type="button" className="rd-btn rd-btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </DesktopLayout>
  );
}
