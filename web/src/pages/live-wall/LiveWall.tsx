import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useSocket } from '../../ws/useSocket';
import { useAuthStore } from '../../store/auth';
import OrdersMap from '../../components/OrdersMap';
import type { DriverForMap } from '../../components/OrdersMap';
import './LiveWall.css';

const CAR_TYPES = ['SEDAN', 'MINIVAN', 'SUV'] as const;

interface Order {
  id: string;
  status: string;
  pickupAt: string;
  pickupAddress: string;
  dropoffAddress: string;
}

/** Parse "lat,lng" or "lat lng" or two numbers. Returns null if not valid geo. */
function parseGeoQuery(q: string): { lat: number; lng: number } | null {
  const s = q.trim().replace(/\s+/g, ',').replace(/[,，]+/g, ',');
  const parts = s.split(',');
  if (parts.length >= 2) {
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

export default function LiveWall() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { socket } = useSocket();
  const [drivers, setDrivers] = useState<DriverForMap[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [futureOrderCoords, setFutureOrderCoords] = useState<Array<{ orderId: string; pickupAt: string; pickupLat: number; pickupLng: number }>>([]);
  const [reports, setReports] = useState<Array<{ id: string; lat: number; lng: number; type: string; description?: string | null; createdAt?: string }>>([]);
  const [centerTrigger, setCenterTrigger] = useState(0);
  const [reportsTrigger, setReportsTrigger] = useState(0);
  const [reportTicks, setReportTicks] = useState(0);
  const [zones, setZones] = useState<Array<{ id: string; name: string; color: string; points: Array<{ lat: number; lng: number }> }>>([]);
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      return sessionStorage.getItem('livewall-search') ?? '';
    } catch {
      return '';
    }
  });
  const [filterCarType, setFilterCarType] = useState<string>('');
  const [focusCenter, setFocusCenter] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem('livewall-search', searchQuery);
    } catch {
      // ignore
    }
  }, [searchQuery]);

  const canAssign = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';

  useEffect(() => {
    if (!socket) return;
    const onOrders = (data: unknown) => {
      const list = Array.isArray(data) ? (data as Order[]) : [];
      setOrders(list);
    };
    socket.on('orders', onOrders);
    return () => { socket.off('orders', onOrders); };
  }, [socket]);

  useEffect(() => {
    api.get<Order[]>('/orders').then((data) => setOrders(Array.isArray(data) ? data : [])).catch(() => setOrders([]));
  }, []);

  useEffect(() => {
    api.get<Array<{ id: string; nickname: string; role: string; lat?: number | null; lng?: number | null; phone?: string | null; driverId?: string | null; carType?: string | null; carPlateNumber?: string | null; available?: boolean }>>('/users')
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        const driverUsers = list.filter((u) => u.role === 'DRIVER');
        const withCoords = driverUsers.filter((d) => d.lat != null && d.lng != null && Number.isFinite(d.lat) && Number.isFinite(d.lng));
        setDrivers(withCoords.map((d) => ({
          id: d.id,
          nickname: d.nickname ?? 'Driver',
          phone: d.phone ?? null,
          lat: d.lat!,
          lng: d.lng!,
          status: d.available === false ? 'offline' : 'available',
          carType: d.carType ?? null,
          carPlateNumber: d.carPlateNumber ?? null,
          driverId: d.driverId ?? null,
        })));
      })
      .catch(() => setDrivers([]));
  }, [orders]);

  useEffect(() => {
    if (!canAssign) return;
    api.get<Array<{ orderId: string; pickupAt: string; pickupLat: number; pickupLng: number }>>('/planning/order-coords')
      .then(setFutureOrderCoords)
      .catch(() => setFutureOrderCoords([]));
  }, [canAssign, orders]);

  useEffect(() => {
    if (!canAssign) return;
    api.get<Array<{ id: string; name: string; color: string; points: Array<{ lat: number; lng: number }> }>>('/zones')
      .then(setZones)
      .catch(() => setZones([]));
  }, [canAssign]);

  useEffect(() => {
    const minLat = 40.9;
    const maxLat = 41.3;
    const minLng = -74.2;
    const maxLng = -73.8;
    api.get<Array<{ id: string; lat: number; lng: number; type: string; description?: string | null; createdAt?: string }>>(`/reports?minLat=${minLat}&maxLat=${maxLat}&minLng=${minLng}&maxLng=${maxLng}&sinceMinutes=2`)
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch(() => setReports([]));
  }, [reportsTrigger]);

  useEffect(() => {
    const interval = setInterval(() => setReportTicks((n) => n + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  const reportsOnMap = useMemo(() => {
    const now = Date.now();
    const maxAgeMs = 60 * 1000;
    return reports.filter((r) => {
      const created = r.createdAt ? new Date(r.createdAt).getTime() : now;
      return now - created < maxAgeMs;
    });
  }, [reports, reportTicks]);

  const futurePickups = futureOrderCoords.map((f) => ({
    orderId: f.orderId,
    lat: f.pickupLat,
    lng: f.pickupLng,
    pickupAt: f.pickupAt,
  }));

  const filteredDrivers = useMemo(() => {
    let list = drivers;
    if (filterCarType && CAR_TYPES.includes(filterCarType as (typeof CAR_TYPES)[number])) {
      list = list.filter((d) => d.carType === filterCarType);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    const byId = list.filter((d) => (d.id || '').toLowerCase().includes(q) || (d.driverId || '').toLowerCase().includes(q));
    if (byId.length > 0) return byId;
    return list;
  }, [drivers, filterCarType, searchQuery]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredDrivers.forEach((d) => {
      const key = d.carType || 'OTHER';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [filteredDrivers]);

  const activeCount = orders.filter((o) => o.status === 'SCHEDULED' || o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS').length;

  function handleSearch() {
    const q = searchQuery.trim();
    if (!q) {
      setFocusCenter(null);
      setCenterTrigger((c) => c + 1);
      return;
    }
    const geo = parseGeoQuery(q);
    if (geo) {
      setFocusCenter(geo);
      setCenterTrigger((c) => c + 1);
      return;
    }
    const match = drivers.find(
      (d) =>
        (d.id || '').toLowerCase().includes(q.toLowerCase()) ||
        (d.driverId || '').toLowerCase().includes(q.toLowerCase())
    );
    if (match && match.lat != null && match.lng != null) {
      setFocusCenter({ lat: match.lat, lng: match.lng });
      setCenterTrigger((c) => c + 1);
    } else {
      setFocusCenter(null);
    }
  }

  return (
    <div className="live-wall-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 120px)' }}>
      <div style={{ flexShrink: 0, padding: '0.5rem 0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>{t('nav.liveWall')}</h1>
        <input
          type="text"
          className="rd-input live-wall-search"
          placeholder={t('liveWall.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          aria-label={t('liveWall.searchPlaceholder')}
        />
        <button type="button" className="rd-btn rd-btn-primary" onClick={handleSearch}>
          {t('liveWall.go')}
        </button>
        <select
          className="rd-input live-wall-type-filter"
          value={filterCarType}
          onChange={(e) => setFilterCarType(e.target.value)}
          aria-label={t('liveWall.filterByType')}
        >
          <option value="">{t('liveWall.allTypes')}</option>
          {CAR_TYPES.map((type) => (
            <option key={type} value={type}>{t('auth.carType_' + type)}</option>
          ))}
        </select>
        <button type="button" className="rd-btn rd-btn-secondary" onClick={() => { setFocusCenter(null); setCenterTrigger((c) => c + 1); }}>
          {t('dashboard.recenter')}
        </button>
        <button type="button" className="rd-btn rd-btn-secondary" onClick={() => setReportsTrigger((r) => r + 1)}>
          {t('common.refresh')}
        </button>
        <span className="rd-text-muted live-wall-status" style={{ fontSize: '0.875rem' }}>
          {filteredDrivers.length} {t('dashboard.drivers')}
          {Object.keys(typeCounts).length > 0 && (
            <span className="live-wall-types"> ({Object.entries(typeCounts).map(([type, n]) => type === 'OTHER' ? `${n} ${t('liveWall.other')}` : `${n} ${t('auth.carType_' + type)}`).join(', ')})</span>
          )}
          {' · '}{activeCount} {t('liveWall.active')}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 320, position: 'relative', borderRadius: 'var(--rd-radius-lg)', overflow: 'hidden' }}>
        <OrdersMap
          drivers={filteredDrivers}
          showDriverMarkers={canAssign}
          routeData={null}
          currentUserLocation={undefined}
          centerTrigger={centerTrigger}
          onRecenter={() => { setFocusCenter(null); setCenterTrigger((c) => c + 1); }}
          recenterLabel={t('dashboard.recenter')}
          reports={reportsOnMap}
          futureOrderPickups={futurePickups}
          focusCenter={focusCenter}
          zones={canAssign ? zones : undefined}
        />
      </div>
    </div>
  );
}
