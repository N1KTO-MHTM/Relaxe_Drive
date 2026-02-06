import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DesktopLayout from '../layouts/DesktopLayout';
import { api } from '../api/client';

type CostControlResponse = {
  maps: number;
  translation: number;
  ai: number;
  tts: number;
  limits?: Partial<Record<'maps' | 'translation' | 'ai' | 'tts', number>>;
  exceeded?: Partial<Record<'maps' | 'translation' | 'ai' | 'tts', boolean>>;
};

const CATEGORIES: ('maps' | 'translation' | 'ai' | 'tts')[] = ['maps', 'translation', 'ai', 'tts'];

export default function CostControlMode() {
  const { t } = useTranslation();
  const [data, setData] = useState<CostControlResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function fetchCosts(silent = false) {
    if (!silent) setError(null);
    return api
      .get<CostControlResponse>('/cost-control')
      .then((res) => { setData(res); setError(null); })
      .catch((err) => setError(err?.message || t('costControl.loadError')))
      .finally(() => { if (!silent) setLoading(false); });
  }

  useEffect(() => {
    setLoading(true);
    fetchCosts(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => fetchCosts(true), 60_000);
    return () => clearInterval(interval);
  }, []);

  const hasExceeded = data?.exceeded && Object.values(data.exceeded).some(Boolean);

  return (
    <DesktopLayout>
      <div className="cost-control-mode">
        <div className="rd-panel-header">
          <h1>{t('costControl.title')}</h1>
          <button type="button" className="rd-btn rd-btn-secondary" onClick={() => fetchCosts(false)} disabled={loading}>
            {t('common.refresh')}
          </button>
        </div>
        <p className="rd-text-muted" style={{ marginBottom: '1rem' }}>
          {t('costControl.maps')}, {t('costControl.translation')}, {t('costControl.ai')}, {t('costControl.tts')}.
        </p>
        {loading && <p className="logs-mode__muted">{t('common.loading')}</p>}
        {error && <p className="rd-text-critical" style={{ marginBottom: '1rem' }}>{error}</p>}
        {hasExceeded && (
          <div role="alert" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 6, background: 'var(--rd-error-bg, rgba(220,50,50,0.15))', color: 'var(--rd-error, #e66)' }}>
            {t('costControl.limitExceeded')}
          </div>
        )}
        {!loading && !error && data && (
          <div style={{ marginTop: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>{t('costControl.usage')}</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {CATEGORIES.map((key) => {
                const limit = data.limits?.[key];
                const isExceeded = data.exceeded?.[key];
                return (
                  <li
                    key={key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0',
                      borderBottom: '1px solid var(--rd-border, #333)',
                      ...(isExceeded ? { background: 'var(--rd-error-bg, rgba(220,50,50,0.1))', margin: '0 -0.5rem', paddingLeft: '0.5rem', paddingRight: '0.5rem', borderRadius: 4 } : {}),
                    }}
                  >
                    <span>{t('costControl.' + key)}</span>
                    <span>
                      <strong>{data[key] ?? 0}</strong>
                      {limit != null && (
                        <span className="rd-text-muted" style={{ marginLeft: '0.5rem', fontSize: '0.9rem' }}>
                          / {limit} {t('costControl.limit')}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </DesktopLayout>
  );
}
