import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

type CostSnapshot = Record<'maps' | 'translation' | 'ai' | 'tts', number>;

const CATEGORIES: (keyof CostSnapshot)[] = ['maps', 'translation', 'ai', 'tts'];

export default function CostControl() {
  const { t } = useTranslation();
  const [data, setData] = useState<CostSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function fetchCosts(silent = false) {
    if (!silent) setError(null);
    return api
      .get<CostSnapshot>('/cost-control')
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
        {!loading && !error && data && (
          <div className="cost-control-usage" style={{ marginTop: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>{t('costControl.usage')}</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {CATEGORIES.map((key) => (
                <li
                  key={key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0',
                    borderBottom: '1px solid var(--rd-border, #333)',
                  }}
                >
                  <span>{t('costControl.' + key)}</span>
                  <strong>{data[key] ?? 0}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
