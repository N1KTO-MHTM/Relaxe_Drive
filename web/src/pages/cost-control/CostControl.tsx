import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

type CostControlResponse = {
  maps: number;
  translation: number;
  ai: number;
  tts: number;
  limits?: Partial<Record<'maps' | 'translation' | 'ai' | 'tts', number>>;
  exceeded?: Partial<Record<'maps' | 'translation' | 'ai' | 'tts', boolean>>;
};

const CATEGORIES: ('maps' | 'translation' | 'ai' | 'tts')[] = ['maps', 'translation', 'ai', 'tts'];

export default function CostControl() {
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
  }, [t]);

  useEffect(() => {
    const interval = setInterval(() => fetchCosts(true), 60_000);
    return () => clearInterval(interval);
  }, [t]);

  useEffect(() => {
    const onFocus = () => fetchCosts(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [t]);

  const hasExceeded = data?.exceeded && Object.values(data.exceeded).some(Boolean);

  return (
    <div className="rd-page">
      <div className="rd-panel">
        <div className="rd-panel-header">
          <h1>{t('costControl.title')}</h1>
        </div>
        <p className="rd-muted">
          {t('costControl.maps')}, {t('costControl.translation')}, {t('costControl.ai')}, {t('costControl.tts')}.
        </p>
        {loading && <p>{t('costControl.loading')}</p>}
        {error && <p className="rd-error">{error}</p>}
        {hasExceeded && (
          <div className="rd-alert rd-alert-error" role="alert" style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 6, background: 'var(--rd-error-bg, rgba(220,50,50,0.15))', color: 'var(--rd-error, #e66)' }}>
            {t('costControl.limitExceeded')}
          </div>
        )}
        {!loading && !error && data && (
          <div className="cost-control-usage" style={{ marginTop: '1rem' }}>
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
                        <span className="rd-muted" style={{ marginLeft: '0.5rem', fontSize: '0.9rem' }}>
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
    </div>
  );
}
