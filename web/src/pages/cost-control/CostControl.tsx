import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import './CostControl.css';

type CostControlResponse = {
  maps: number;
  translation: number;
  ai: number;
  tts: number;
  limits?: Partial<Record<'maps' | 'translation' | 'ai' | 'tts', number>>;
  exceeded?: Partial<Record<'maps' | 'translation' | 'ai' | 'tts', boolean>>;
};

const CATEGORIES: ('maps' | 'translation' | 'ai' | 'tts')[] = ['maps', 'translation', 'ai', 'tts'];

type CostControlTab = 'overview' | 'limits' | 'summary';

export default function CostControl() {
  const { t } = useTranslation();
  const [data, setData] = useState<CostControlResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<CostControlTab>('overview');
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  function fetchCosts(silent = false) {
    if (!silent) setError(null);
    return api
      .get<CostControlResponse>('/cost-control')
      .then((res) => {
        setData(res);
        setError(null);
        setLastFetched(new Date());
      })
      .catch((err) => setError(err?.message || t('costControl.loadError')))
      .finally(() => {
        if (!silent) setLoading(false);
      });
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
  const totalCalls = data
    ? (data.maps ?? 0) + (data.translation ?? 0) + (data.ai ?? 0) + (data.tts ?? 0)
    : 0;

  return (
    <div className="rd-page">
      <div className="rd-panel cost-control-page">
        <div className="cost-control-page__top">
          <div className="cost-control-page__head">
            <h1 className="cost-control-page__title">{t('costControl.title')}</h1>
            <button
              type="button"
              className="rd-btn rd-btn-primary cost-control-page__refresh"
              onClick={() => {
                setLoading(true);
                fetchCosts(false);
              }}
              disabled={loading}
            >
              {loading ? t('costControl.loading') : t('common.refresh')}
            </button>
          </div>
          <nav className="cost-control-page__tabs" aria-label={t('costControl.title')}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'overview'}
              className={`cost-control-page__tab ${tab === 'overview' ? 'cost-control-page__tab--active' : ''}`}
              onClick={() => setTab('overview')}
            >
              {t('costControl.tabOverview')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'limits'}
              className={`cost-control-page__tab ${tab === 'limits' ? 'cost-control-page__tab--active' : ''}`}
              onClick={() => setTab('limits')}
            >
              {t('costControl.tabLimits')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'summary'}
              className={`cost-control-page__tab ${tab === 'summary' ? 'cost-control-page__tab--active' : ''}`}
              onClick={() => setTab('summary')}
            >
              {t('costControl.tabSummary')}
            </button>
          </nav>
        </div>

        {loading && !data && <p className="rd-text-muted">{t('costControl.loading')}</p>}
        {error && <p className="rd-text-critical cost-control-page__error">{error}</p>}
        {hasExceeded && (
          <div role="alert" className="cost-control-page__alert">
            {t('costControl.limitExceeded')}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {tab === 'overview' && (
              <div className="cost-control-page__cards" role="region" aria-label={t('costControl.tabOverview')}>
                {CATEGORIES.map((key) => {
                  const value = data[key] ?? 0;
                  const limit = data.limits?.[key];
                  const isExceeded = data.exceeded?.[key];
                  const pct = limit != null && limit > 0 ? Math.min(100, (value / limit) * 100) : null;
                  const label = key.toUpperCase();
                  return (
                    <article
                      key={key}
                      className={`cost-control-page__card ${isExceeded ? 'cost-control-page__card--exceeded' : ''}`}
                      aria-label={`${label}: ${value.toLocaleString()}, ${limit != null ? t('costControl.limit') + ' ' + limit.toLocaleString() : t('costControl.noLimitSet')}`}
                    >
                      <h2 className="cost-control-page__card-title">{label}</h2>
                      <div className="cost-control-page__card-value">{value.toLocaleString()}</div>
                      {limit != null ? (
                        <>
                          <div className="cost-control-page__card-limit">
                            {t('costControl.limit')}: {limit.toLocaleString()}
                          </div>
                          {pct != null && (
                            <div className="cost-control-page__progress-wrap">
                              <div
                                className={`cost-control-page__progress-bar ${isExceeded ? 'cost-control-page__progress-bar--exceeded' : ''}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                          {isExceeded && (
                            <span className="cost-control-page__badge cost-control-page__badge--exceeded">
                              {t('costControl.exceeded')}
                            </span>
                          )}
                        </>
                      ) : (
                        <p className="cost-control-page__card-muted">{t('costControl.noLimitSet')}</p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {tab === 'limits' && (
              <div className="cost-control-page__limits-panel" role="region" aria-label={t('costControl.tabLimits')}>
                <div className="rd-table-wrapper">
                  <table className="rd-table cost-control-page__table">
                    <thead>
                      <tr>
                        <th>{t('costControl.category')}</th>
                        <th>{t('costControl.usage').replace(' (API calls)', '')}</th>
                        <th>{t('costControl.limit')}</th>
                        <th>{t('costControl.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CATEGORIES.map((key) => {
                        const value = data[key] ?? 0;
                        const limit = data.limits?.[key];
                        const isExceeded = data.exceeded?.[key];
                        return (
                          <tr key={key} className={isExceeded ? 'cost-control-page__row-exceeded' : ''}>
                            <td>{t('costControl.' + key)}</td>
                            <td>{value.toLocaleString()}</td>
                            <td>{limit != null ? limit.toLocaleString() : '—'}</td>
                            <td>
                              {limit == null ? (
                                <span className="rd-text-muted">{t('costControl.noLimitSet')}</span>
                              ) : isExceeded ? (
                                <span className="cost-control-page__badge cost-control-page__badge--exceeded">
                                  {t('costControl.exceeded')}
                                </span>
                              ) : (
                                <span className="cost-control-page__badge cost-control-page__badge--ok">
                                  {t('costControl.statusOk')}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="rd-text-muted cost-control-page__hint">{t('costControl.limitsHint')}</p>
              </div>
            )}

            {tab === 'summary' && (
              <div className="cost-control-page__summary-panel" role="region" aria-label={t('costControl.tabSummary')}>
                <div className="cost-control-page__summary-card">
                  <div className="cost-control-page__summary-label">{t('costControl.totalCalls')}</div>
                  <div className="cost-control-page__summary-value">{totalCalls.toLocaleString()}</div>
                </div>
                {lastFetched && (
                  <p className="rd-text-muted cost-control-page__last-updated">
                    {t('costControl.lastUpdated')}: {lastFetched.toLocaleString()}
                  </p>
                )}
                <ul className="cost-control-page__summary-list">
                  {CATEGORIES.map((key) => (
                    <li key={key}>
                      <span className="cost-control-page__summary-list-label">{t('costControl.' + key)}</span>
                      <strong>{(data[key] ?? 0).toLocaleString()}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
