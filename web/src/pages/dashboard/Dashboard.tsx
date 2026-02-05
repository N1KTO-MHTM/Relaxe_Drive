import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSocket } from '../../ws/useSocket';
import { useAuthStore } from '../../store/auth';
import { api } from '../../api/client';
import OrdersMap from '../../components/OrdersMap';
import './Dashboard.css';

interface Order {
  id: string;
  status: string;
  pickupAt: string;
  pickupAddress: string;
  dropoffAddress: string;
  driverId?: string | null;
}

interface User {
  id: string;
  nickname: string;
  role: string;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { socket, connected } = useSocket();
  const user = useAuthStore((s) => s.user);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pickupAt, setPickupAt] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [drivers, setDrivers] = useState<User[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const canCreateOrder = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';
  const canAssign = canCreateOrder;
  const canChangeStatus = !!user?.role;

  useEffect(() => {
    let cancelled = false;
    api.get<Order[]>('/orders').then((data) => {
      if (!cancelled) setOrders(Array.isArray(data) ? data : []);
    }).catch(() => {
      if (!cancelled) setOrders([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [showForm]);

  useEffect(() => {
    if (!socket) return;
    const onOrders = (data: unknown) => setOrders(Array.isArray(data) ? data as Order[] : []);
    socket.on('orders', onOrders);
    return () => { socket.off('orders', onOrders); };
  }, [socket]);

  useEffect(() => {
    if (!canAssign) return;
    api.get<User[]>('/users').then((data) => {
      setDrivers(Array.isArray(data) ? data.filter((u) => u.role === 'DRIVER') : []);
    }).catch(() => setDrivers([]));
  }, [canAssign]);

  async function handleAssign(orderId: string, driverId: string) {
    if (!driverId) return;
    setAssigningId(orderId);
    try {
      await api.patch(`/orders/${orderId}/assign`, { driverId });
    } finally {
      setAssigningId(null);
    }
  }

  async function handleStatusChange(orderId: string, status: 'IN_PROGRESS' | 'COMPLETED') {
    setStatusUpdatingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
    } finally {
      setStatusUpdatingId(null);
    }
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    if (!pickupAt || !pickupAddress.trim() || !dropoffAddress.trim()) {
      setSubmitError('Fill pickup time and both addresses');
      return;
    }
    try {
      await api.post('/orders', {
        pickupAt: new Date(pickupAt).toISOString(),
        pickupAddress: pickupAddress.trim(),
        dropoffAddress: dropoffAddress.trim(),
      });
      setPickupAt('');
      setPickupAddress('');
      setDropoffAddress('');
      setShowForm(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create order');
    }
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-page__top">
        <h1>{t('dashboard.title')}</h1>
        <span className={`rd-badge ${connected ? 'rd-badge-ok' : 'rd-badge-critical'}`}>
          WS {connected ? t('status.ok') : 'Offline'}
        </span>
      </div>
      <div className="dashboard-page__grid">
        <aside className="dashboard-page__sidebar rd-panel">
          <div className="rd-panel-header">
            <h2>{t('dashboard.orders')}</h2>
            {canCreateOrder && (
              <button type="button" className="rd-btn rd-btn-primary" onClick={() => setShowForm(!showForm)}>
                {t('dashboard.newOrder')}
              </button>
            )}
          </div>
          {canCreateOrder && showForm && (
            <form onSubmit={handleCreateOrder} className="dashboard-order-form">
              <label>{t('dashboard.pickupAt')}</label>
              <input type="datetime-local" className="rd-input" value={pickupAt} onChange={(e) => setPickupAt(e.target.value)} required />
              <label>{t('dashboard.pickupAddress')}</label>
              <input type="text" className="rd-input" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder="Address" required />
              <label>{t('dashboard.dropoffAddress')}</label>
              <input type="text" className="rd-input" value={dropoffAddress} onChange={(e) => setDropoffAddress(e.target.value)} placeholder="Address" required />
              {submitError && <p className="rd-text-critical">{submitError}</p>}
              <button type="submit" className="rd-btn rd-btn-primary">{t('dashboard.createOrder')}</button>
            </form>
          )}
          {loading ? (
            <p className="rd-text-muted">Loading…</p>
          ) : orders.length === 0 ? (
            <p className="rd-text-muted">{t('dashboard.noOrders')}</p>
          ) : (
            <ul className="dashboard-orders-list">
              {orders.map((o) => (
                <li key={o.id} className="rd-panel dashboard-order-item">
                  <span className="rd-badge">{o.status}</span>
                  <div>{new Date(o.pickupAt).toLocaleString()}</div>
                  <div className="rd-text-muted">{o.pickupAddress} → {o.dropoffAddress}</div>
                  {canAssign && o.status === 'SCHEDULED' && !o.driverId && (
                    <div className="dashboard-order-assign">
                      <select
                        className="rd-input"
                        id={`driver-${o.id}`}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) handleAssign(o.id, v);
                        }}
                      >
                        <option value="">{t('dashboard.assignDriver')}</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>{d.nickname}</option>
                        ))}
                      </select>
                      {assigningId === o.id && <span className="rd-text-muted">…</span>}
                    </div>
                  )}
                  {o.driverId && <div className="rd-text-muted">{t('dashboard.assigned')}</div>}
                  {canChangeStatus && o.status === 'ASSIGNED' && (
                    <button type="button" className="rd-btn" disabled={!!statusUpdatingId} onClick={() => handleStatusChange(o.id, 'IN_PROGRESS')}>
                      {statusUpdatingId === o.id ? '…' : t('dashboard.start')}
                    </button>
                  )}
                  {canChangeStatus && o.status === 'IN_PROGRESS' && (
                    <button type="button" className="rd-btn rd-btn-primary" disabled={!!statusUpdatingId} onClick={() => handleStatusChange(o.id, 'COMPLETED')}>
                      {statusUpdatingId === o.id ? '…' : t('dashboard.complete')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>
        <div className="dashboard-page__map rd-map-container">
          <OrdersMap />
        </div>
        <aside className="dashboard-page__sidebar rd-panel">
          <div className="rd-panel-header">
            <h2>{t('dashboard.drivers')}</h2>
          </div>
          <p className="rd-text-muted">Driver statuses and {t('dashboard.alerts')}.</p>
        </aside>
      </div>
    </div>
  );
}
