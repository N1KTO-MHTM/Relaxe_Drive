import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
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

interface Driver {
  id: string;
  nickname: string;
  role: string;
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
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [view, setView] = useState<'day' | 'week'>('week');
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
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

  useEffect(() => {
    if (user?.role !== 'ADMIN' && user?.role !== 'DISPATCHER') return;
    api.get<Driver[]>('/users').then((data) => {
      setDrivers(Array.isArray(data) ? data.filter((u) => u.role === 'DRIVER') : []);
    }).catch(() => setDrivers([]));
  }, [user?.role]);

  const filteredOrders = selectedDriverId
    ? orders.filter((o) => o.driverId === selectedDriverId)
    : orders;

  const ordersByDay = filteredOrders.reduce<Record<string, Order[]>>((acc, o) => {
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
    <div className="rd-page">
      <div className="calendar-page rd-panel">
      <div className="rd-panel-header calendar-header">
        <h1>{t('calendar.title')}</h1>
        <div className="calendar-controls">
          {(user?.role === 'ADMIN' || user?.role === 'DISPATCHER') && (
            <select
              className="rd-input calendar-driver-select"
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              title={t('calendar.chooseDriver')}
            >
              <option value="">{t('calendar.allDrivers')}</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.nickname}</option>
              ))}
            </select>
          )}
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
          <button type="button" className="rd-btn rd-btn-secondary" onClick={loadCalendar} disabled={loading}>
            {t('common.refresh')}
          </button>
        </div>
      </div>
      <p className="rd-text-muted">
        {selectedDriverId
          ? t('calendar.driverSchedule', { name: drivers.find((d) => d.id === selectedDriverId)?.nickname ?? '' })
          : t('calendar.preOrder')}
      </p>
      {selectedDriverId && (
        <p style={{ marginTop: '0.25rem' }}>
          <Link to={`/drivers?open=${selectedDriverId}`} className="rd-btn rd-btn-secondary" style={{ fontSize: '0.875rem', padding: '0.35rem 0.75rem' }}>
            {t('calendar.viewDriverDetails')}
          </Link>
        </p>
      )}
      {loading ? (
        <p className="rd-text-muted">{t('common.loading')}</p>
      ) : (
        <div className="calendar-grid">
          {weekDays.map((dayKey) => (
            <div
              key={dayKey}
              className={`calendar-day ${selectedDate === dayKey ? 'calendar-day--selected' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedDate(dayKey)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDate(dayKey); } }}
              aria-pressed={selectedDate === dayKey}
            >
              <h3 className="calendar-day-title">{new Date(dayKey + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</h3>
              <ul className="calendar-day-orders">
                {(ordersByDay[dayKey] || [])
                  .sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime())
                  .map((o) => (
                    <li key={o.id} className="calendar-order-card rd-panel">
                      <span className="rd-badge">{t('calendar.status_' + o.status, { defaultValue: o.status })}</span>
                      <time>{new Date(o.pickupAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</time>
                      <div className="rd-text-muted">{o.pickupAddress} → {o.dropoffAddress}</div>
                      {!selectedDriverId && o.driverId && (
                        <div className="calendar-order-driver rd-text-muted">
                          {drivers.find((d) => d.id === o.driverId)?.nickname ?? o.driverId}
                        </div>
                      )}
                    </li>
                  ))}
              </ul>
              {canCreateOrder && (
                <button
                  type="button"
                  className="rd-btn rd-btn-primary calendar-day-create"
                  onClick={(e) => { e.stopPropagation(); navigate('/dashboard', { state: { createOrderDate: dayKey } }); }}
                >
                  {t('calendar.createOrderForDay')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
