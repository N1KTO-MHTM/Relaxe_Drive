import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import DesktopLayout from '../layouts/DesktopLayout';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';

const WEB_APP_URL = (typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_WEB_APP_URL?: string } }).env?.VITE_WEB_APP_URL) || 'http://localhost:5173';

interface Order {
  id: string;
  status: string;
  pickupAt: string;
  pickupAddress: string;
  dropoffAddress: string;
  driverId?: string | null;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export default function CalendarMode() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [view, setView] = useState<'day' | 'week'>('week');
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const canCreateOrder = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';

  const from = startOfDay(new Date(selectedDate));
  const to = view === 'day' ? endOfDay(from) : new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);

  function loadCalendar() {
    setLoading(true);
    api
      .get<Order[]>(`/orders?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCalendar();
  }, [from.toISOString(), to.toISOString()]);

  const ordersByDay = orders.reduce<Record<string, Order[]>>((acc, o) => {
    const key = toDateKey(new Date(o.pickupAt));
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  const weekDays: string[] = [];
  for (let i = 0; i < (view === 'day' ? 1 : 7); i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    weekDays.push(toDateKey(d));
  }

  function openCreateOrderForDay(dayKey: string) {
    const url = `${WEB_APP_URL.replace(/\/$/, '')}/dashboard?createOrderDate=${encodeURIComponent(dayKey)}`;
    if (typeof window !== 'undefined' && (window as { electronAPI?: { openExternal?: (u: string) => void } }).electronAPI?.openExternal) {
      (window as { electronAPI: { openExternal: (u: string) => void } }).electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  }

  return (
    <DesktopLayout>
      <div className="rd-panel" style={{ maxWidth: 1200 }}>
        <div className="rd-panel-header" style={{ flexWrap: 'wrap', gap: 'var(--rd-space-md)' }}>
          <h1>{t('calendar.title')}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rd-space-sm)' }}>
            <input
              type="date"
              className="rd-input"
              style={{ width: 'auto', minWidth: 140 }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <button
              type="button"
              className={`rd-btn ${view === 'day' ? 'rd-btn-primary' : ''}`}
              onClick={() => setView('day')}
            >
              {t('calendar.day')}
            </button>
            <button
              type="button"
              className={`rd-btn ${view === 'week' ? 'rd-btn-primary' : ''}`}
              onClick={() => setView('week')}
            >
              {t('calendar.week')}
            </button>
            <button type="button" className="rd-btn rd-btn-secondary" onClick={loadCalendar} disabled={loading}>
              {t('common.refresh')}
            </button>
          </div>
        </div>
        <p className="rd-text-muted" style={{ marginBottom: 'var(--rd-space-md)' }}>{t('calendar.preOrder')}</p>
        {loading ? (
          <p className="rd-text-muted">{t('common.loading')}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--rd-space-lg)', marginTop: 'var(--rd-space-lg)' }}>
            {weekDays.map((dayKey) => (
              <div
                key={dayKey}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedDate(dayKey)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDate(dayKey); } }}
                style={{
                  border: '1px solid var(--rd-border)',
                  borderRadius: 'var(--rd-radius-md)',
                  padding: 'var(--rd-space-md)',
                  background: selectedDate === dayKey ? 'rgba(88, 166, 255, 0.1)' : 'var(--rd-bg-elevated)',
                  borderColor: selectedDate === dayKey ? 'var(--rd-accent)' : undefined,
                  cursor: 'pointer',
                }}
              >
                <h3 style={{ fontSize: '0.875rem', margin: '0 0 var(--rd-space-sm)', color: 'var(--rd-text-muted)' }}>
                  {new Date(dayKey + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {(ordersByDay[dayKey] || [])
                    .sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime())
                    .map((o) => (
                      <li
                        key={o.id}
                        className="rd-panel"
                        style={{ padding: 'var(--rd-space-sm) var(--rd-space-md)', marginBottom: 'var(--rd-space-sm)', fontSize: '0.8125rem', borderRadius: 'var(--rd-radius)' }}
                      >
                        <span className="rd-badge">{o.status}</span>{' '}
                        <time>{new Date(o.pickupAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</time>
                        <div className="rd-text-muted">{o.pickupAddress} → {o.dropoffAddress}</div>
                      </li>
                    ))}
                </ul>
                {canCreateOrder && (
                  <button
                    type="button"
                    className="rd-btn rd-btn-primary"
                    style={{ marginTop: 'var(--rd-space-sm)', width: '100%' }}
                    onClick={(e) => { e.stopPropagation(); openCreateOrderForDay(dayKey); }}
                  >
                    {t('calendar.createOrderForDay')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DesktopLayout>
  );
}
