import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { downloadCsv } from '../../utils/exportCsv';
import Pagination, { paginate, DEFAULT_PAGE_SIZE } from '../../components/Pagination';
import './Drivers.css';

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

export default function Drivers() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [list, setList] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const showPhone = canSeeDriverPhones(user?.role);

  const filteredList = searchQuery.trim()
    ? list.filter(
        (d) =>
          (d.nickname ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (d.phone ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
      : list;

  const paginatedList = useMemo(
    () => paginate(filteredList, page, DEFAULT_PAGE_SIZE),
    [filteredList, page],
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<DriverRow[]>('/users')
      .then((data) => {
        if (!cancelled) setList(Array.isArray(data) ? data.filter((u) => u.role === 'DRIVER') : []);
        if (!cancelled) setError(null);
      })
      .catch(() => {
        if (!cancelled) setList([]);
        if (!cancelled) setError('Failed to load drivers');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
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
            <button type="button" className="rd-btn" onClick={() => downloadCsv(list, 'drivers.csv', [
              { key: 'nickname', label: t('drivers.nickname') },
              { key: 'phone', label: t('drivers.phone') },
            ])}>
              {t('drivers.exportCsv')}
            </button>
            <Link to="/dashboard" className="rd-btn rd-btn-primary">
              {t('drivers.showOnMap')}
            </Link>
          </div>
        </div>
        <p className="rd-text-muted drivers-subtitle">{t('drivers.subtitle')}</p>
        {error && <p className="rd-text-critical drivers-error">{error}</p>}
        {loading && <p className="rd-text-muted">Loading…</p>}
        {!loading && !error && list.length === 0 && <p className="rd-text-muted">{t('drivers.noDrivers')}</p>}
        {!loading && !error && list.length > 0 && filteredList.length === 0 && <p className="rd-text-muted">{t('drivers.noMatch')}</p>}
        {!loading && !error && filteredList.length > 0 && (
          <div className="rd-table-wrapper">
            <table className="rd-table" style={{ width: '100%' }}>
<thead>
              <tr>
                <th>{t('drivers.nickname')}</th>
                {showPhone && <th>{t('drivers.phone')}</th>}
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
