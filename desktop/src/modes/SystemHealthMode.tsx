import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';

/** API, WebSocket, Redis, Maps, Translation, AI, Queues, Latency. */
export default function SystemHealthMode() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<Record<string, string>>({});

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    fetch(`${apiUrl}/health`)
      .then((r) => r.json())
      .then((d) => setHealth(d.services || {}))
      .catch(() => setHealth({ api: 'error' }));
  }, []);

  return (
    <div className="health-mode">
      <nav className="rd-panel" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <Link to="/control">{t('modes.control')}</Link>
        <Link to="/wall">{t('modes.wall')}</Link>
        <Link to="/health">{t('modes.health')}</Link>
        <Link to="/logs">{t('modes.logs')}</Link>
      </nav>
      <div className="rd-panel">
        <h1>{t('health.title')}</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          {['database', 'websocket', 'redis', 'maps', 'ai'].map((key) => (
            <div key={key} className="rd-panel" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--rd-text-muted)' }}>{t('health.' + key)}</div>
              <span className={`rd-badge rd-badge-${health[key] === 'ok' ? 'ok' : 'critical'}`}>
                {health[key] || 'unknown'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
