import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import DesktopLayout from '../layouts/DesktopLayout';

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
    <DesktopLayout>
      <div className="health-mode">
        <div className="rd-panel">
          <h1>{t('health.title')}</h1>
          <div className="health-mode__grid">
            {['database', 'websocket', 'redis', 'maps', 'ai'].map((key) => (
              <div key={key} className="rd-panel health-mode__card">
                <div className="health-mode__label">{t('health.' + key)}</div>
                <span className={`rd-badge rd-badge-${health[key] === 'ok' ? 'ok' : 'critical'}`}>
                  {health[key] || 'unknown'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DesktopLayout>
  );
}
