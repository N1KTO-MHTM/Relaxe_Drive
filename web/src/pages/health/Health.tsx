import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  services: {
    database: string;
    websocket?: string;
    redis?: string;
    maps?: string;
    ai?: string;
  };
}

export default function Health() {
  const { t } = useTranslation();
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback((silent = false) => {
    if (!silent) setError(null);
    api
      .get<HealthResponse>('/health')
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => { if (!silent) setLoading(false); });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchHealth(false);
  }, [fetchHealth]);

  useEffect(() => {
    const interval = setInterval(() => fetchHealth(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading && !data) return <div className="rd-page"><div className="rd-panel"><p>{t('analytics.loading')}</p></div></div>;
  if (error && !data) return <div className="rd-page"><div className="rd-panel"><p className="rd-error">{error}</p></div></div>;

  const statusKey = data?.status === 'ok' ? 'status.ok' : 'status.warning';
  const services = data?.services ? Object.entries(data.services) : [];

  return (
    <div className="rd-page">
      <div className="rd-panel">
        <div className="rd-panel-header">
          <h1>{t('health.title')}</h1>
        </div>
        <p className="rd-text-muted">{t('health.subtitle')}</p>

        <div className="health-summary" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span className="rd-badge" style={{ background: data?.status === 'ok' ? 'var(--rd-success-bg, rgba(40,160,80,0.2))' : 'var(--rd-warning-bg, rgba(200,140,0,0.2))', color: data?.status === 'ok' ? 'var(--rd-success, #6a6)' : 'var(--rd-warning, #da0)' }}>
            {t(statusKey)}
          </span>
          {data?.timestamp && (
            <span className="rd-text-muted" style={{ fontSize: '0.9rem' }}>
              {t('health.lastCheck')}: {new Date(data.timestamp).toLocaleString()}
            </span>
          )}
        </div>

        <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem', fontSize: '1rem' }}>{t('health.services')}</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {services.map(([name, status]) => (
            <li
              key={name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: '1px solid var(--rd-border, #333)',
              }}
            >
              <span style={{ textTransform: 'capitalize' }}>{name}</span>
              <span
                className="rd-badge"
                style={{
                  background: status === 'ok' ? 'var(--rd-success-bg, rgba(40,160,80,0.2))' : 'var(--rd-warning-bg, rgba(200,140,0,0.2))',
                  color: status === 'ok' ? 'var(--rd-success, #6a6)' : 'var(--rd-warning, #da0)',
                }}
              >
                {status === 'ok' ? t('status.ok') : status}
              </span>
            </li>
          ))}
        </ul>
        <button type="button" className="rd-btn rd-btn-secondary" style={{ marginTop: '1rem' }} onClick={() => { setLoading(true); fetchHealth(false); }}>
          {t('auth.retry')}
        </button>
      </div>
    </div>
  );
}
