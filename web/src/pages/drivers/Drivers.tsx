import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { downloadCsv } from '../../utils/exportCsv';

import Pagination, { paginate, DEFAULT_PAGE_SIZE } from '../../components/Pagination';
import { TripCardMap } from '../../components/TripCardMap';
import './Drivers.css';

const CAR_TYPES = ['SEDAN', 'MINIVAN', 'SUV'] as const;
type CarTypeTab = 'ALL' | (typeof CAR_TYPES)[number] | 'OTHER';

type DriverDetailTab = 'info' | 'trips' | 'earnings';

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
  carId?: string | null;
  carType?: string | null;
  carPlateNumber?: string | null;
  carCapacity?: number | null;
  carModelAndYear?: string | null;
}

interface DriverStats {
  totalEarningsCents: number;
  totalMiles: number;
  updatedAt?: string | null;
}

interface TripSummary {
  id: string;
  orderId: string;
  pickupAddress: string;
  dropoffAddress: string;
  startedAt: string;
  completedAt: string;
  distanceKm: number;
  earningsCents: number;
  polyline?: string | null;
}

export default function Drivers() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [list, setList] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [carTypeTab, setCarTypeTab] = useState<CarTypeTab>('ALL');
  const [locationFilter, setLocationFilter] = useState<'all' | 'onMap'>('all');
  const [selectedDriver, setSelectedDriver] = useState<DriverRow | null>(null);
  const [detailTab, setDetailTab] = useState<DriverDetailTab>('info');
  const [driverStats, setDriverStats] = useState<DriverStats | null>(null);
  const [tripHistory, setTripHistory] = useState<TripSummary[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tripHistoryFrom, setTripHistoryFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10);
  });
  const [tripHistoryTo, setTripHistoryTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [editDriverIds, setEditDriverIds] = useState(false);
  const [editDriverIdValue, setEditDriverIdValue] = useState('');
  const [editCarIdValue, setEditCarIdValue] = useState('');
  const [savingDriverIds, setSavingDriverIds] = useState(false);
  const [deleteConfirmDriver, setDeleteConfirmDriver] = useState<DriverRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editModalDriver, setEditModalDriver] = useState<DriverRow | null>(null);
  const [editModalDriverId, setEditModalDriverId] = useState('');
  const [editModalCarId, setEditModalCarId] = useState('');
  const [savingEditModal, setSavingEditModal] = useState(false);
  const showPhone = canSeeDriverPhones(user?.role);
  const canViewDriverDetail = showPhone;
  const canEditDriverIds = user?.role === 'ADMIN';

  const listByCarType = useMemo(() => {
    if (carTypeTab === 'ALL') return list;
    if (carTypeTab === 'OTHER') return list.filter((d) => !d.carType || !CAR_TYPES.includes(d.carType as (typeof CAR_TYPES)[number]));
    return list.filter((d) => d.carType === carTypeTab);
  }, [list, carTypeTab]);

  const listByLocation = useMemo(() => {
    if (locationFilter !== 'onMap') return listByCarType;
    return listByCarType.filter((d) => d.lat != null && d.lng != null && Number.isFinite(d.lat) && Number.isFinite(d.lng));
  }, [listByCarType, locationFilter]);

  const filteredList = searchQuery.trim()
    ? listByLocation.filter(
      (d) =>
        (d.nickname ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.phone ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.email ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.driverId ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.carId ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.id ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    : listByLocation;

  const paginatedList = useMemo(
    () => paginate(filteredList, page, DEFAULT_PAGE_SIZE),
    [filteredList, page],
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery, carTypeTab, locationFilter]);

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

  const openDriverId = searchParams.get('open');
  useEffect(() => {
    if (!openDriverId || list.length === 0 || !canViewDriverDetail) return;
    const driver = list.find((d) => d.id === openDriverId);
    if (driver) {
      setSelectedDriver(driver);
      setDetailTab('info');
      setEditDriverIdValue(driver.driverId ?? '');
      setEditCarIdValue(driver.carId ?? '');
      setEditDriverIds(false);
      setSearchParams((p) => { const next = new URLSearchParams(p); next.delete('open'); return next; }, { replace: true });
    }
  }, [openDriverId, list, canViewDriverDetail, setSearchParams]);

  useEffect(() => {
    if (selectedDriver) {
      setEditDriverIdValue(selectedDriver.driverId ?? '');
      setEditCarIdValue(selectedDriver.carId ?? '');
    }
  }, [selectedDriver?.id, selectedDriver?.driverId, selectedDriver?.carId]);

  useEffect(() => {
    if (!selectedDriver || !canViewDriverDetail) {
      setDriverStats(null);
      setTripHistory([]);
      return;
    }
    setDetailLoading(true);
    const fromParam = tripHistoryFrom ? `${tripHistoryFrom}T00:00:00.000Z` : undefined;
    const toParam = tripHistoryTo ? `${tripHistoryTo}T23:59:59.999Z` : undefined;
    const query = new URLSearchParams();
    if (fromParam) query.set('from', fromParam);
    if (toParam) query.set('to', toParam);
    const qs = query.toString() ? `?${query.toString()}` : '';
    Promise.all([
      api.get<DriverStats>(`/users/${selectedDriver.id}/stats`).catch(() => null),
      api.get<TripSummary[]>(`/users/${selectedDriver.id}/trip-history${qs}`).catch(() => []),
    ]).then(([stats, trips]) => {
      setDriverStats(stats ?? null);
      setTripHistory(Array.isArray(trips) ? trips : []);
    }).finally(() => setDetailLoading(false));
  }, [selectedDriver?.id, canViewDriverDetail, tripHistoryFrom, tripHistoryTo]);

  function formatTripTime(start: string, end: string): string {
    const s = new Date(start);
    const e = new Date(end);
    return `${s.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }

  function formatTripDuration(start: string, end: string): string {
    const min = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
  }

  /** Average speed in mph from distance (km) and time. Returns 0 if duration < 1 min or speed > 120 mph (bad data). */
  function tripAvgSpeedMph(distanceKm: number, startedAt: string, completedAt: string): number {
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    const hours = durationMs / (1000 * 60 * 60);
    if (hours < 1 / 60) return 0; // require at least 1 minute
    const kmh = distanceKm / hours;
    const mph = Math.round(kmh / 1.60934);
    return mph > 120 ? 0 : mph; // hide unrealistic speeds
  }

  function googleMapsRouteUrl(origin: string, destination: string): string {
    const params = new URLSearchParams({
      origin: origin,
      destination: destination,
    });
    return `https://www.google.com/maps/dir/?api=1&${params.toString()}`;
  }

  async function saveDriverIds() {
    if (!selectedDriver || !canEditDriverIds) return;
    setSavingDriverIds(true);
    try {
      const updated = await api.patch<{ driverId?: string | null; carId?: string | null }>(
        `/users/${selectedDriver.id}/driver-ids`,
        { driverId: editDriverIdValue.trim() || null, carId: editCarIdValue.trim() || null }
      );
      setSelectedDriver((prev) => prev ? { ...prev, driverId: updated.driverId ?? null, carId: updated.carId ?? null } : null);
      setList((prev) => prev.map((d) => d.id === selectedDriver.id ? { ...d, driverId: updated.driverId ?? null, carId: updated.carId ?? null } : d));
      setEditDriverIds(false);
    } catch {
      // keep edit mode; user can retry
    } finally {
      setSavingDriverIds(false);
    }
  }

  async function handleDeleteDriver() {
    if (!deleteConfirmDriver || !canEditDriverIds) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteConfirmDriver.id}`);
      setList((prev) => prev.filter((d) => d.id !== deleteConfirmDriver.id));
      if (selectedDriver?.id === deleteConfirmDriver.id) setSelectedDriver(null);
      setDeleteConfirmDriver(null);
    } catch (err) {
      alert(t('drivers.deleteFailed') || 'Failed to delete driver');
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveEditModal() {
    if (!editModalDriver || !canEditDriverIds) return;
    setSavingEditModal(true);
    try {
      const updated = await api.patch<{ driverId?: string | null; carId?: string | null }>(
        `/users/${editModalDriver.id}/driver-ids`,
        { driverId: editModalDriverId.trim() || null, carId: editModalCarId.trim() || null }
      );
      setList((prev) => prev.map((d) => d.id === editModalDriver.id ? { ...d, driverId: updated.driverId ?? null, carId: updated.carId ?? null } : d));
      if (selectedDriver?.id === editModalDriver.id) {
        setSelectedDriver((prev) => prev ? { ...prev, driverId: updated.driverId ?? null, carId: updated.carId ?? null } : null);
      }
      setEditModalDriver(null);
    } catch {
      alert(t('drivers.saveFailed') || 'Failed to save changes');
    } finally {
      setSavingEditModal(false);
    }
  }

  return (
    <div className="rd-page">
      <div className="drivers-page rd-premium-panel">
        <div className="rd-panel-header">
          <h1>{t('drivers.title')}</h1>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              className="rd-input drivers-search-input"
              placeholder={t('drivers.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t('drivers.search')}
            />
            <button type="button" className="rd-btn" onClick={() => downloadCsv(filteredList, 'drivers.csv', [
              { key: 'nickname', label: t('drivers.nickname') },
              { key: 'phone', label: t('drivers.phone') },
              { key: 'email', label: t('auth.email') },
              { key: 'driverId', label: t('drivers.driverId') },
              { key: 'carId', label: t('drivers.carId') },
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
        {!loading && list.length > 0 && (
          <p className="drivers-summary rd-text-muted">{t('drivers.summaryCount', { count: list.length })}</p>
        )}
        {error && <p className="rd-text-critical drivers-error">{error}</p>}
        {loading && <p className="rd-text-muted">{t('common.loading')}</p>}
        {!loading && !error && list.length === 0 && <p className="rd-text-muted">{t('drivers.noDrivers')}</p>}
        {!loading && !error && list.length > 0 && (
          <>
            <div className="drivers-filters-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
              <span className="rd-text-muted" style={{ marginRight: '0.25rem' }}>{t('drivers.show')}:</span>
              <button
                type="button"
                className={`drivers-tab ${locationFilter === 'all' ? 'active' : ''}`}
                onClick={() => setLocationFilter('all')}
              >
                {t('drivers.locationAll')} ({list.length})
              </button>
              <button
                type="button"
                className={`drivers-tab ${locationFilter === 'onMap' ? 'active' : ''}`}
                onClick={() => setLocationFilter('onMap')}
              >
                {t('drivers.locationOnMap')} ({list.filter((d) => d.lat != null && d.lng != null).length})
              </button>
            </div>
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
                  {showPhone && <th title={t('drivers.userId')}>#</th>}
                  <th>{t('drivers.driverId')}</th>
                  <th>{t('drivers.carId')}</th>
                  <th>{t('auth.carType')}</th>
                  <th>{t('auth.carPlateNumber')}</th>
                  <th>{t('drivers.status')}</th>
                  {canViewDriverDetail && <th></th>}
                  {canEditDriverIds && <th>{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedList.map((d) => {
                  const hasLocation = d.lat != null && d.lng != null && Number.isFinite(d.lat) && Number.isFinite(d.lng);
                  const statusKey = d.blocked ? 'blocked' : d.bannedUntil && new Date(d.bannedUntil) > new Date() ? 'banned' : hasLocation ? 'onMap' : 'offline';
                  const isSelected = selectedDriver?.id === d.id;
                  return (
                    <tr
                      key={d.id}
                      className={isSelected ? 'drivers-row--selected' : ''}
                      onClick={() => canViewDriverDetail && setSelectedDriver(isSelected ? null : d)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => canViewDriverDetail && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelectedDriver(selectedDriver?.id === d.id ? null : d))}
                    >
                      <td><strong>{d.nickname}</strong></td>
                      {showPhone && <td>{d.phone ?? '—'}</td>}
                      {showPhone && <td className="drivers-cell-email">{d.email ? <a href={`mailto:${d.email}`}>{d.email}</a> : '—'}</td>}
                      {showPhone && <td className="drivers-cell-id rd-id-compact" title={d.id}>{paginatedList.indexOf(d) + 1 + (page - 1) * DEFAULT_PAGE_SIZE}</td>}
                      <td>{d.driverId ?? '—'}</td>
                      <td>{d.carId ?? '—'}</td>
                      <td>{d.carType ? t('auth.carType_' + d.carType) : '—'}</td>
                      <td>{d.carPlateNumber ?? '—'}</td>
                      <td>
                        <span className={`rd-badge ${statusKey === 'onMap' ? 'rd-badge-ok' : statusKey === 'blocked' || statusKey === 'banned' ? 'rd-badge-critical' : ''}`}>
                          {t(`drivers.${statusKey}`)}
                        </span>
                      </td>
                      {canViewDriverDetail && (
                        <td>
                          <button
                            type="button"
                            className="rd-btn rd-btn-secondary drivers-btn-view"
                            onClick={(e) => { e.stopPropagation(); setSelectedDriver(isSelected ? null : d); }}
                          >
                            {t('drivers.viewDetails')}
                          </button>
                        </td>
                      )}
                      {canEditDriverIds && (
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              type="button"
                              className="rd-btn rd-btn-secondary"
                              onClick={(e) => { e.stopPropagation(); setEditModalDriver(d); setEditModalDriverId(d.driverId ?? ''); setEditModalCarId(d.carId ?? ''); }}
                              title={t('common.edit')}
                            >
                              {t('common.edit')}
                            </button>
                            <button
                              type="button"
                              className="rd-btn rd-btn-critical"
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirmDriver(d); }}
                              title={t('common.delete')}
                            >
                              {t('common.delete')}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={page} totalItems={filteredList.length} onPageChange={setPage} />
          </div>
        )}

        {canViewDriverDetail && selectedDriver && (
          <div className="drivers-detail-panel rd-premium-panel">
            <div className="drivers-detail-header">
              <h2>{selectedDriver.nickname} — {t('drivers.driverInfo')}</h2>
              <button type="button" className="rd-btn" onClick={() => setSelectedDriver(null)} aria-label={t('common.close')}>×</button>
            </div>
            <div className="drivers-detail-tabs">
              <button type="button" className={`drivers-tab ${detailTab === 'info' ? 'active' : ''}`} onClick={() => setDetailTab('info')}>{t('drivers.driverInfo')}</button>
              <button type="button" className={`drivers-tab ${detailTab === 'trips' ? 'active' : ''}`} onClick={() => setDetailTab('trips')}>{t('drivers.tripHistory')}</button>
              <button type="button" className={`drivers-tab ${detailTab === 'earnings' ? 'active' : ''}`} onClick={() => setDetailTab('earnings')}>{t('drivers.earnings')}</button>
            </div>
            {detailLoading ? (
              <p className="rd-text-muted">{t('common.loading')}</p>
            ) : (
              <>
                {detailTab === 'info' && (
                  <div className="drivers-detail-info">
                    <div className="drivers-detail-stat-row"><span>{t('drivers.nickname')}</span><span>{selectedDriver.nickname}</span></div>
                    {showPhone && <div className="drivers-detail-stat-row"><span>{t('drivers.phone')}</span><span>{selectedDriver.phone ?? '—'}</span></div>}
                    {showPhone && <div className="drivers-detail-stat-row"><span>{t('auth.email')}</span><span>{selectedDriver.email ?? '—'}</span></div>}
                    <div className="drivers-detail-stat-row">
                      <span>{t('drivers.driverId')}</span>
                      {editDriverIds && canEditDriverIds ? (
                        <input type="text" className="rd-input" style={{ width: '6rem' }} value={editDriverIdValue} onChange={(e) => setEditDriverIdValue(e.target.value)} placeholder="—" />
                      ) : (
                        <span>{selectedDriver.driverId ?? '—'}{canEditDriverIds && <button type="button" className="rd-link drivers-edit-ids-btn" onClick={() => setEditDriverIds(true)}>{t('common.edit')}</button>}</span>
                      )}
                    </div>
                    <div className="drivers-detail-stat-row">
                      <span>{t('drivers.carId')}</span>
                      {editDriverIds && canEditDriverIds ? (
                        <input type="text" className="rd-input" style={{ width: '6rem' }} value={editCarIdValue} onChange={(e) => setEditCarIdValue(e.target.value)} placeholder="—" />
                      ) : (
                        <span>{selectedDriver.carId ?? '—'}</span>
                      )}
                    </div>
                    {editDriverIds && canEditDriverIds && (
                      <div className="drivers-detail-stat-row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button type="button" className="rd-btn rd-btn-primary" disabled={savingDriverIds} onClick={saveDriverIds}>{savingDriverIds ? t('common.saving') : t('common.save')}</button>
                        <button type="button" className="rd-btn rd-btn-secondary" disabled={savingDriverIds} onClick={() => { setEditDriverIds(false); setEditDriverIdValue(selectedDriver.driverId ?? ''); setEditCarIdValue(selectedDriver.carId ?? ''); }}>{t('common.cancel')}</button>
                      </div>
                    )}
                    <div className="drivers-detail-stat-row"><span>{t('auth.carType')}</span><span>{selectedDriver.carType ? t('auth.carType_' + selectedDriver.carType) : '—'}</span></div>
                    <div className="drivers-detail-stat-row"><span>{t('auth.carPlateNumber')}</span><span>{selectedDriver.carPlateNumber ?? '—'}</span></div>
                    {selectedDriver.carModelAndYear && <div className="drivers-detail-stat-row"><span>{t('auth.carModelAndYear')}</span><span>{selectedDriver.carModelAndYear}</span></div>}
                  </div>
                )}
                {detailTab === 'trips' && (
                  <div className="drivers-trip-history">
                    <div className="drivers-trip-history-filters">
                      <label className="drivers-trip-history-filter-label">{t('drivers.tripHistoryFrom')}</label>
                      <input type="date" className="rd-input" value={tripHistoryFrom} onChange={(e) => setTripHistoryFrom(e.target.value)} />
                      <label className="drivers-trip-history-filter-label">{t('drivers.tripHistoryTo')}</label>
                      <input type="date" className="rd-input" value={tripHistoryTo} onChange={(e) => setTripHistoryTo(e.target.value)} />
                    </div>
                    {tripHistory.length > 0 && (
                      <div className="drivers-trip-history-actions">
                        <button
                          type="button"
                          className="rd-btn rd-btn-secondary"
                          onClick={() => downloadCsv(
                            tripHistory.map((t) => ({
                              date: new Date(t.completedAt).toLocaleDateString(),
                              time: formatTripTime(t.startedAt, t.completedAt),
                              pickup: t.pickupAddress,
                              dropoff: t.dropoffAddress,
                              distanceMi: (t.distanceKm / 1.60934).toFixed(1),
                              duration: formatTripDuration(t.startedAt, t.completedAt),
                              avgSpeedMph: tripAvgSpeedMph(t.distanceKm, t.startedAt, t.completedAt),
                              earnings: `$${(t.earningsCents / 100).toFixed(2)}`,
                            })),
                            `trips-${selectedDriver.nickname.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`,
                            [
                              { key: 'date', label: t('drivers.exportDate') },
                              { key: 'time', label: t('drivers.exportTime') },
                              { key: 'pickup', label: t('dashboard.pickupAddress') },
                              { key: 'dropoff', label: t('dashboard.dropoffAddress') },
                              { key: 'distanceMi', label: t('drivers.exportDistance') },
                              { key: 'duration', label: t('drivers.duration') },
                              { key: 'avgSpeedMph', label: t('drivers.avgSpeed') },
                              { key: 'earnings', label: t('drivers.earnings') },
                            ]
                          )}
                        >
                          {t('drivers.exportCsv')}
                        </button>
                      </div>
                    )}
                    {tripHistory.length === 0 ? (
                      <p className="rd-text-muted">{t('drivers.noTripHistory')}</p>
                    ) : (
                      <ul className="drivers-trip-list">
                        {tripHistory.map((trip) => {
                          const avgMph = tripAvgSpeedMph(trip.distanceKm, trip.startedAt, trip.completedAt);
                          const riskyCount = 0; // placeholder until backend supports risky events
                          const distanceMi = (trip.distanceKm / 1.60934).toFixed(1);
                          return (
                            <li key={trip.id} className="drivers-trip-card drivers-trip-card--with-map">
                              <a
                                href={googleMapsRouteUrl(trip.pickupAddress, trip.dropoffAddress)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="drivers-trip-card-map-link"
                                title={t('drivers.viewRoute')}
                              >
                                <TripCardMap
                                  pickupAddress={trip.pickupAddress}
                                  dropoffAddress={trip.dropoffAddress}
                                  polyline={trip.polyline}
                                  className="drivers-trip-card-map"
                                />
                                <span className="drivers-trip-card-map-hint">{t('drivers.viewRoute')}</span>
                              </a>
                              <div className="drivers-trip-card-body">
                                <div className="drivers-trip-route">{trip.pickupAddress} → {trip.dropoffAddress}</div>
                                <div className="drivers-trip-meta-row">
                                  <span className="drivers-trip-meta">
                                    <span className="drivers-trip-time">{formatTripTime(trip.startedAt, trip.completedAt)}</span>
                                    <span className="drivers-trip-sep"> · </span>
                                    <span className="drivers-trip-distance">{distanceMi} mi</span>
                                  </span>
                                  <span className="drivers-trip-vehicle-icon" aria-hidden>🚗</span>
                                </div>
                                <div className="drivers-trip-card-footer">
                                  {avgMph > 0 && (
                                    <span className="drivers-trip-avg-speed">
                                      <span className="drivers-trip-speed-icon" aria-hidden>⏱</span>
                                      {avgMph} mph
                                    </span>
                                  )}
                                  <span className="drivers-trip-risky-pill">
                                    {riskyCount === 0
                                      ? t('drivers.riskyEvents', { count: 0 })
                                      : t('drivers.riskyEvents', { count: riskyCount })}
                                    <span className="drivers-trip-risky-lock" aria-hidden>🔒</span>
                                  </span>
                                  <a
                                    href={googleMapsRouteUrl(trip.pickupAddress, trip.dropoffAddress)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="drivers-trip-route-link"
                                  >
                                    {t('drivers.viewRoute')}
                                  </a>
                                  <div className="drivers-trip-earnings">${(trip.earningsCents / 100).toFixed(2)}</div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
                {detailTab === 'earnings' && (
                  <div className="drivers-earnings-panel">
                    <div className="drivers-earnings-total">
                      <div className="drivers-earnings-row">
                        <span>{t('drivers.totalEarned')}</span>
                        <strong>{driverStats != null ? `$${(driverStats.totalEarningsCents / 100).toFixed(2)}` : '—'}</strong>
                      </div>
                      <div className="drivers-earnings-row">
                        <span>{t('drivers.totalMiles')}</span>
                        <strong>{driverStats != null ? (driverStats.totalMiles).toFixed(1) : '—'} mi</strong>
                      </div>
                    </div>
                    {tripHistory.length > 0 && (
                      <p className="rd-text-muted drivers-earnings-hint">{t('drivers.tripHistoryLast7')}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmDriver && (
          <div className="rd-modal-overlay" onClick={() => !deleting && setDeleteConfirmDriver(null)}>
            <div className="rd-modal" onClick={(e) => e.stopPropagation()}>
              <div className="rd-modal-header">
                <h2>{t('drivers.deleteConfirmTitle')}</h2>
                <button type="button" className="rd-btn" onClick={() => setDeleteConfirmDriver(null)} disabled={deleting}>×</button>
              </div>
              <div className="rd-modal-body">
                <p>{t('drivers.deleteConfirmMessage', { name: deleteConfirmDriver.nickname })}</p>
                <p className="rd-text-muted">{t('drivers.deleteConfirmWarning')}</p>
              </div>
              <div className="rd-modal-footer">
                <button type="button" className="rd-btn rd-btn-critical" onClick={handleDeleteDriver} disabled={deleting}>
                  {deleting ? t('common.deleting') : t('common.delete')}
                </button>
                <button type="button" className="rd-btn rd-btn-secondary" onClick={() => setDeleteConfirmDriver(null)} disabled={deleting}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Driver Modal */}
        {editModalDriver && (
          <div className="rd-modal-overlay" onClick={() => !savingEditModal && setEditModalDriver(null)}>
            <div className="rd-modal" onClick={(e) => e.stopPropagation()}>
              <div className="rd-modal-header">
                <h2>{t('drivers.editDriver', { name: editModalDriver.nickname })}</h2>
                <button type="button" className="rd-btn" onClick={() => setEditModalDriver(null)} disabled={savingEditModal}>×</button>
              </div>
              <div className="rd-modal-body">
                <div className="rd-form-group">
                  <label htmlFor="edit-driver-id">{t('drivers.driverId')}</label>
                  <input
                    id="edit-driver-id"
                    type="text"
                    className="rd-input"
                    value={editModalDriverId}
                    onChange={(e) => setEditModalDriverId(e.target.value)}
                    placeholder="1, 2, 3..."
                  />
                </div>
                <div className="rd-form-group">
                  <label htmlFor="edit-car-id">{t('drivers.carId')}</label>
                  <input
                    id="edit-car-id"
                    type="text"
                    className="rd-input"
                    value={editModalCarId}
                    onChange={(e) => setEditModalCarId(e.target.value)}
                    placeholder="Minivan1, Sedan1..."
                  />
                </div>
              </div>
              <div className="rd-modal-footer">
                <button type="button" className="rd-btn rd-btn-primary" onClick={handleSaveEditModal} disabled={savingEditModal}>
                  {savingEditModal ? t('common.saving') : t('common.save')}
                </button>
                <button type="button" className="rd-btn rd-btn-secondary" onClick={() => setEditModalDriver(null)} disabled={savingEditModal}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
