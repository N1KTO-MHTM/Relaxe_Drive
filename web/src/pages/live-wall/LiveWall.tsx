import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useSocket } from '../../ws/useSocket';
import { useAuthStore } from '../../store/auth';
import OrdersMap from '../../components/OrdersMap';
import type { DriverForMap } from '../../components/OrdersMap';

interface Order {
  id: string;
  status: string;
  pickupAt: string;
  pickupAddress: string;
  dropoffAddress: string;
}

export default function LiveWall() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { socket } = useSocket();
  const [drivers, setDrivers] = useState<DriverForMap[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [futureOrderCoords, setFutureOrderCoords] = useState<Array<{ orderId: string; pickupAt: string; pickupLat: number; pickupLng: number }>>([]);
  const [reports, setReports] = useState<Array<{ id: string; lat: number; lng: number; type: string; description?: string | null }>>([]);
  const [centerTrigger, setCenterTrigger] = useState(0);
  const [reportsTrigger, setReportsTrigger] = useState(0);

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
    const minLat = 40.9;
    const maxLat = 41.3;
    const minLng = -74.2;
    const maxLng = -73.8;
    api.get<Array<{ id: string; lat: number; lng: number; type: string; description?: string | null }>>(`/reports?minLat=${minLat}&maxLat=${maxLat}&minLng=${minLng}&maxLng=${maxLng}&sinceMinutes=120`)
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch(() => setReports([]));
  }, [reportsTrigger]);

  const futurePickups = futureOrderCoords.map((f) => ({
    orderId: f.orderId,
    lat: f.pickupLat,
    lng: f.pickupLng,
    pickupAt: f.pickupAt,
  }));

  return (
    <div className="live-wall-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 120px)' }}>
      <div style={{ flexShrink: 0, padding: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>{t('nav.liveWall')}</h1>
        <button type="button" className="rd-btn rd-btn-secondary" onClick={() => setCenterTrigger((c) => c + 1)}>
          {t('dashboard.recenter')}
        </button>
        <button type="button" className="rd-btn rd-btn-secondary" onClick={() => setReportsTrigger((r) => r + 1)}>
          {t('common.refresh')}
        </button>
        <span className="rd-text-muted" style={{ fontSize: '0.875rem' }}>
          {drivers.length} {t('dashboard.drivers')} · {orders.filter((o) => o.status === 'SCHEDULED' || o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS').length} active
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 'var(--rd-radius-lg)', overflow: 'hidden' }}>
        <OrdersMap
          drivers={drivers}
          showDriverMarkers={canAssign}
          routeData={null}
          currentUserLocation={undefined}
          centerTrigger={centerTrigger}
          onRecenter={() => setCenterTrigger((c) => c + 1)}
          recenterLabel={t('dashboard.recenter')}
          reports={reports}
          futureOrderPickups={futurePickups}
        />
      </div>
    </div>
  );
}
