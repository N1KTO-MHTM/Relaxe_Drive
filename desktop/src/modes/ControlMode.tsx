import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef } from 'react';
import DesktopLayout from '../layouts/DesktopLayout';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';

type CtrlSubTab = 'orders' | 'drivers' | 'sessions';

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
  phone?: string | null;
}

interface Session {
  id: string;
  userId: string;
  device?: string | null;
  ip?: string | null;
  lastActiveAt: string;
  createdAt: string;
}

/** Control Mode with sub-tabs: Orders, Drivers, Sessions. */
export default function ControlMode() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<CtrlSubTab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canSeeDrivers = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';
  const canSeeSessions = canSeeDrivers;
  const notifiedOrderIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setError(null);
    if (tab === 'orders') {
      api.get<Order[]>('/orders').then((data) => {
        const list = Array.isArray(data) ? data : [];
        setOrders(list);
        if (user?.role === 'DRIVER' && window.electronAPI?.showNotification) {
          list.forEach((o) => {
            if (o.driverId === user.id && o.status === 'ASSIGNED' && !notifiedOrderIds.current.has(o.id)) {
              notifiedOrderIds.current.add(o.id);
              window.electronAPI.showNotification(t('modes.assignedTitle') || 'Order assigned', o.pickupAddress || o.pickupAt);
            }
          });
        }
      }).catch((e) => {
        setOrders([]);
        setError(e instanceof Error ? e.message : 'Failed');
      }).finally(() => setLoading(false));
    }
    if (tab === 'drivers' && canSeeDrivers) {
      api.get<User[]>('/users').then((data) => {
        setDrivers(Array.isArray(data) ? data.filter((u) => u.role === 'DRIVER') : []);
      }).catch((e) => {
        setDrivers([]);
        setError(e instanceof Error ? e.message : 'Failed');
      }).finally(() => setLoading(false));
    }
    if (tab === 'drivers' && !canSeeDrivers) setLoading(false);
    if (tab === 'sessions' && canSeeSessions) {
      api.get<Session[]>('/users/sessions').then((data) => {
        setSessions(Array.isArray(data) ? data : []);
      }).catch((e) => {
        setSessions([]);
        setError(e instanceof Error ? e.message : 'Failed');
      }).finally(() => setLoading(false));
    }
    if (tab === 'sessions' && !canSeeSessions) setLoading(false);
  }, [tab, canSeeDrivers, canSeeSessions, user?.id, user?.role, t]);

  useEffect(() => {
    if (user?.role !== 'DRIVER' || !window.electronAPI?.showNotification) return;
    const interval = setInterval(() => {
      api.get<Order[]>('/orders').then((data) => {
        const list = Array.isArray(data) ? data : [];
        list.forEach((o) => {
          if (o.driverId === user?.id && o.status === 'ASSIGNED' && !notifiedOrderIds.current.has(o.id)) {
            notifiedOrderIds.current.add(o.id);
            window.electronAPI?.showNotification?.(t('modes.assignedTitle') || 'Order assigned', o.pickupAddress || o.pickupAt);
          }
        });
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [user?.id, user?.role, t]);

  return (
    <DesktopLayout>
      <div className="control-mode">
        <div className="rd-panel">
          <h1>{t('modes.control')}</h1>
          <p style={{ color: 'var(--rd-text-muted)', marginBottom: '1rem' }}>
            Full access: map, orders, drivers, calendar, roles, sessions. Local cache &amp; auto-reconnect enabled.
          </p>
          <div className="mode-subtabs">
            <button type="button" className={`rd-btn ${tab === 'orders' ? 'rd-btn-primary' : ''}`} onClick={() => setTab('orders')}>
              {t('modes.ctrlOrders')}
            </button>
            {canSeeDrivers && (
              <button type="button" className={`rd-btn ${tab === 'drivers' ? 'rd-btn-primary' : ''}`} onClick={() => setTab('drivers')}>
                {t('modes.ctrlDrivers')}
              </button>
            )}
            {canSeeSessions && (
              <button type="button" className={`rd-btn ${tab === 'sessions' ? 'rd-btn-primary' : ''}`} onClick={() => setTab('sessions')}>
                {t('modes.ctrlSessions')}
              </button>
            )}
          </div>
          <div className="mode-content">
            {tab === 'orders' && (
              <>
                {loading && <p className="logs-mode__muted">Loading…</p>}
                {error && <p className="logs-mode__error">{error}</p>}
                {!loading && !error && orders.length === 0 && <p className="logs-mode__muted">{t('modes.noOrders')}</p>}
                {!loading && orders.length > 0 && (
                  <div className="logs-mode__table-wrap">
                    <table className="logs-mode__table">
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Pickup</th>
                          <th>Route</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((o) => (
                          <tr key={o.id}>
                            <td><span className="rd-badge">{o.status}</span></td>
                            <td>{new Date(o.pickupAt).toLocaleString()}</td>
                            <td>{o.pickupAddress} → {o.dropoffAddress}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            {tab === 'drivers' && canSeeDrivers && (
              <>
                {loading && <p className="logs-mode__muted">Loading…</p>}
                {error && <p className="logs-mode__error">{error}</p>}
                {!loading && !error && drivers.length === 0 && <p className="logs-mode__muted">{t('modes.noDrivers')}</p>}
                {!loading && drivers.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {drivers.map((d) => (
                      <li key={d.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--rd-border)' }}>
                        <strong>{d.nickname}</strong> {d.phone ? ` — ${d.phone}` : ''} <span className="rd-badge">{d.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {tab === 'sessions' && canSeeSessions && (
              <>
                {loading && <p className="logs-mode__muted">Loading…</p>}
                {error && <p className="logs-mode__error">{error}</p>}
                {!loading && !error && sessions.length === 0 && <p className="logs-mode__muted">{t('modes.noSessions')}</p>}
                {!loading && sessions.length > 0 && (
                  <div className="logs-mode__table-wrap">
                    <table className="logs-mode__table">
                      <thead>
                        <tr>
                          <th>User ID</th>
                          <th>Device</th>
                          <th>IP</th>
                          <th>Last active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s) => (
                          <tr key={s.id}>
                            <td>{s.userId}</td>
                            <td>{s.device || '—'}</td>
                            <td>{s.ip || '—'}</td>
                            <td>{new Date(s.lastActiveAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DesktopLayout>
  );
}
