import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import './Calendar.css';

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

export default function Calendar() {
  const { t } = useTranslation();
  const [view, setView] = useState<'day' | 'week'>('week');
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const from = startOfDay(new Date(selectedDate));
  const to = view === 'day' ? endOfDay(from) : new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<Order[]>(`/orders?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((data) => {
        if (!cancelled) setOrders(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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

  return (
    <div className="calendar-page rd-panel">
      <div className="rd-panel-header calendar-header">
        <h1>{t('calendar.title')}</h1>
        <div className="calendar-controls">
          <input
            type="date"
            className="rd-input calendar-date-input"
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
        </div>
      </div>
      <p className="rd-text-muted">{t('calendar.preOrder')}</p>
      {loading ? (
        <p className="rd-text-muted">Loading…</p>
      ) : (
        <div className="calendar-grid">
          {weekDays.map((dayKey) => (
            <div key={dayKey} className="calendar-day">
              <h3 className="calendar-day-title">{new Date(dayKey + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</h3>
              <ul className="calendar-day-orders">
                {(ordersByDay[dayKey] || [])
                  .sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime())
                  .map((o) => (
                    <li key={o.id} className="calendar-order-card rd-panel">
                      <span className="rd-badge">{o.status}</span>
                      <time>{new Date(o.pickupAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</time>
                      <div className="rd-text-muted">{o.pickupAddress} → {o.dropoffAddress}</div>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
