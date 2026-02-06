import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { downloadCsv } from '../../utils/exportCsv';
import Pagination, { paginate, DEFAULT_PAGE_SIZE } from '../../components/Pagination';
import './Drivers.css';

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

export default function Drivers() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [list, setList] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [carTypeTab, setCarTypeTab] = useState<CarTypeTab>('ALL');
  const showPhone = canSeeDriverPhones(user?.role);

  const listByCarType = useMemo(() => {
    if (carTypeTab === 'ALL') return list;
    if (carTypeTab === 'OTHER') return list.filter((d) => !d.carType || !CAR_TYPES.includes(d.carType as (typeof CAR_TYPES)[number]));
    return list.filter((d) => d.carType === carTypeTab);
  }, [list, carTypeTab]);

  const filteredList = searchQuery.trim()
    ? listByCarType.filter(
        (d) =>
          (d.nickname ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (d.phone ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (d.email ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (d.driverId ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : listByCarType;

  const paginatedList = useMemo(
    () => paginate(filteredList, page, DEFAULT_PAGE_SIZE),
    [filteredList, page],
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery, carTypeTab]);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<DriverRow[]>('/users')
      .then((data) => setList(Array.isArray(data) ? data.filter((u) => u.role === 'DRIVER') : []))
      .catch(() => {
        setList([]);
        setError('Failed to load drivers');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="rd-page">
      <div className="drivers-page rd-panel">
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
            ])}>
              {t('drivers.exportCsv')}
            </button>
            <Link to="/dashboard" className="rd-btn rd-btn-primary">
              {t('drivers.showOnMap')}
            </Link>
            <button type="button" className="rd-btn rd-btn-secondary" onClick={load} disabled={loading}>
              {t('common.refresh')}
            </button>
          </div>
        </div>
        <p className="rd-text-muted drivers-subtitle">{t('drivers.subtitle')}</p>
        {error && <p className="rd-text-critical drivers-error">{error}</p>}
        {loading && <p className="rd-text-muted">{t('common.loading')}</p>}
        {!loading && !error && list.length === 0 && <p className="rd-text-muted">{t('drivers.noDrivers')}</p>}
        {!loading && !error && list.length > 0 && (
          <>
            <div className="drivers-tabs">
              <button
                type="button"
                className={`drivers-tab ${carTypeTab === 'ALL' ? 'active' : ''}`}
                onClick={() => setCarTypeTab('ALL')}
              >
                {t('drivers.tabAll')} ({list.length})
              </button>
              {CAR_TYPES.map((type) => {
                const count = list.filter((d) => d.carType === type).length;
                return (
                  <button
                    key={type}
                    type="button"
                    className={`drivers-tab ${carTypeTab === type ? 'active' : ''}`}
                    onClick={() => setCarTypeTab(type)}
                  >
                    {t('auth.carType_' + type)} ({count})
                  </button>
                );
              })}
              {list.some((d) => !d.carType || !CAR_TYPES.includes(d.carType as (typeof CAR_TYPES)[number])) && (
                <button
                  type="button"
                  className={`drivers-tab ${carTypeTab === 'OTHER' ? 'active' : ''}`}
                  onClick={() => setCarTypeTab('OTHER')}
                >
                  {t('drivers.tabOther')} ({list.filter((d) => !d.carType || !CAR_TYPES.includes(d.carType as (typeof CAR_TYPES)[number])).length})
                </button>
              )}
            </div>
          </>
        )}
        {!loading && !error && list.length > 0 && filteredList.length === 0 && <p className="rd-text-muted">{t('drivers.noMatch')}</p>}
        {!loading && !error && filteredList.length > 0 && (
          <div className="rd-table-wrapper">
            <table className="rd-table" style={{ width: '100%' }}>
<thead>
              <tr>
                <th>{t('drivers.nickname')}</th>
                {showPhone && <th>{t('drivers.phone')}</th>}
                {showPhone && <th>{t('auth.email')}</th>}
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
                      {showPhone && <td>{d.email ?? '—'}</td>}
                      <td>{d.driverId ?? '—'}</td>
                      <td>{d.carType ? t('auth.carType_' + d.carType) : '—'}</td>
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
            <Pagination page={page} totalItems={filteredList.length} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
