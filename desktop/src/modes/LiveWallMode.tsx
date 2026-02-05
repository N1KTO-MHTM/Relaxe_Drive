import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import DesktopLayout from '../layouts/DesktopLayout';
import { api } from '../api/client';
import WallMap from '../components/WallMap';

type WallSubTab = 'map' | 'eta' | 'alerts';

interface Order {
  id: string;
  status: string;
  pickupAt: string;
  pickupAddress: string;
  dropoffAddress: string;
}

/** Live Wall with sub-tabs: Map, ETA, Alerts. */
export default function LiveWallMode() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<WallSubTab>('eta');
  const [orders, setOrders] = useState<Order[]>([]);
  const [health, setHealth] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab === 'eta') {
      setLoading(true);
      api.get<Order[]>('/orders').then((data) => {
        setOrders(Array.isArray(data) ? data : []);
      }).catch(() => setOrders([])).finally(() => setLoading(false));
    }
    if (tab === 'alerts') {
      const url = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      fetch(`${url}/health`).then((r) => r.json()).then((d) => setHealth(d.services || {})).catch(() => setHealth({}));
    }
  }, [tab]);

  return (
    <DesktopLayout fullHeight>
      <div className="wall-mode" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div className="mode-subtabs" style={{ flexShrink: 0, padding: '1rem 1rem 0' }}>
          <button type="button" className={`rd-btn ${tab === 'map' ? 'rd-btn-primary' : ''}`} onClick={() => setTab('map')}>
            {t('modes.wallMap')}
          </button>
          <button type="button" className={`rd-btn ${tab === 'eta' ? 'rd-btn-primary' : ''}`} onClick={() => setTab('eta')}>
            {t('modes.wallEta')}
          </button>
          <button type="button" className={`rd-btn ${tab === 'alerts' ? 'rd-btn-primary' : ''}`} onClick={() => setTab('alerts')}>
            {t('modes.wallAlerts')}
          </button>
        </div>
        <div className="mode-content" style={{ padding: '1rem' }}>
          {tab === 'map' && (
            <div className="rd-panel rd-map-container" style={{ flex: 1, minHeight: 400 }}>
              <WallMap />
            </div>
          )}
          {tab === 'eta' && (
            <div className="rd-panel">
              <h3>{t('modes.wallEta')}</h3>
              {loading && <p className="logs-mode__muted">Loading…</p>}
              {!loading && orders.length === 0 && <p className="logs-mode__muted">{t('modes.noOrders')}</p>}
              {!loading && orders.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {orders.slice(0, 20).map((o) => (
                    <li key={o.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--rd-border)' }}>
                      <span className="rd-badge">{o.status}</span>{' '}
                      {new Date(o.pickupAt).toLocaleString()} — {o.pickupAddress} → {o.dropoffAddress}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {tab === 'alerts' && (
            <div className="rd-panel">
              <h3>{t('modes.wallAlerts')}</h3>
              <div className="health-mode__grid" style={{ marginTop: '1rem' }}>
                {['database', 'websocket', 'redis', 'maps', 'ai'].map((key) => (
                  <div key={key} className="rd-panel health-mode__card">
                    <div className="health-mode__label">{key}</div>
                    <span className={`rd-badge rd-badge-${health[key] === 'ok' ? 'ok' : 'critical'}`}>
                      {health[key] || 'unknown'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DesktopLayout>
  );
}
