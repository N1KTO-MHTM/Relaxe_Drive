import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DesktopLayout from '../layouts/DesktopLayout';
import { api } from '../api/client';
import '../../styles/cost-control-mode.css';

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

export default function CostControlMode() {
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
  }, []);

  useEffect(() => {
    const interval = setInterval(() => fetchCosts(true), 60_000);
    return () => clearInterval(interval);
  }, []);

  const hasExceeded = data?.exceeded && Object.values(data.exceeded).some(Boolean);
  const totalCalls = data
    ? (data.maps ?? 0) + (data.translation ?? 0) + (data.ai ?? 0) + (data.tts ?? 0)
    : 0;

  return (
    <DesktopLayout>
      <div className="cost-control-mode">
        <div className="rd-panel-header cost-control-mode__header">
          <h1>{t('costControl.title')}</h1>
          <button
            type="button"
            className="rd-btn rd-btn-primary"
            onClick={() => {
              setLoading(true);
              fetchCosts(false);
            }}
            disabled={loading}
          >
            {loading ? t('common.loading') : t('common.refresh')}
          </button>
        </div>

        <div className="cost-control-mode__tabs">
          <button
            type="button"
            className={`cost-control-mode__tab ${tab === 'overview' ? 'cost-control-mode__tab--active' : ''}`}
            onClick={() => setTab('overview')}
          >
            {t('costControl.tabOverview')}
          </button>
          <button
            type="button"
            className={`cost-control-mode__tab ${tab === 'limits' ? 'cost-control-mode__tab--active' : ''}`}
            onClick={() => setTab('limits')}
          >
            {t('costControl.tabLimits')}
          </button>
          <button
            type="button"
            className={`cost-control-mode__tab ${tab === 'summary' ? 'cost-control-mode__tab--active' : ''}`}
            onClick={() => setTab('summary')}
          >
            {t('costControl.tabSummary')}
          </button>
        </div>

        {loading && !data && <p className="logs-mode__muted">{t('common.loading')}</p>}
        {error && <p className="rd-text-critical cost-control-mode__error">{error}</p>}
        {hasExceeded && (
          <div
            role="alert"
            className="cost-control-mode__alert"
          >
            {t('costControl.limitExceeded')}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {tab === 'overview' && (
              <div className="cost-control-mode__cards">
                {CATEGORIES.map((key) => {
                  const value = data[key] ?? 0;
                  const limit = data.limits?.[key];
                  const isExceeded = data.exceeded?.[key];
                  const pct = limit != null && limit > 0 ? Math.min(100, (value / limit) * 100) : null;
                  return (
                    <div
                      key={key}
                      className={`cost-control-mode__card ${isExceeded ? 'cost-control-mode__card--exceeded' : ''}`}
                    >
                      <div className="cost-control-mode__card-title">{t('costControl.' + key)}</div>
                      <div className="cost-control-mode__card-value">{value.toLocaleString()}</div>
                      {limit != null && (
                        <div className="cost-control-mode__card-limit">
                          {t('costControl.limit')}: {limit.toLocaleString()}
                        </div>
                      )}
                      {limit == null && (
                        <div className="cost-control-mode__card-muted">{t('costControl.noLimitSet')}</div>
                      )}
                      {pct != null && (
                        <div className="cost-control-mode__progress-wrap">
                          <div
                            className={`cost-control-mode__progress-bar ${isExceeded ? 'cost-control-mode__progress-bar--exceeded' : ''}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                      {isExceeded && <span className="cost-control-mode__badge cost-control-mode__badge--exceeded">{t('costControl.exceeded')}</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'limits' && (
              <div className="cost-control-mode__limits-panel">
                <table className="rd-table cost-control-mode__table">
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
                        <tr key={key} className={isExceeded ? 'cost-control-mode__row-exceeded' : ''}>
                          <td>{t('costControl.' + key)}</td>
                          <td>{value.toLocaleString()}</td>
                          <td>{limit != null ? limit.toLocaleString() : '—'}</td>
                          <td>
                            {limit == null ? (
                              <span className="rd-text-muted">{t('costControl.noLimitSet')}</span>
                            ) : isExceeded ? (
                              <span className="cost-control-mode__badge cost-control-mode__badge--exceeded">{t('costControl.exceeded')}</span>
                            ) : (
                              <span className="cost-control-mode__badge cost-control-mode__badge--ok">{t('costControl.statusOk')}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="rd-text-muted cost-control-mode__hint">
                  {t('costControl.limitsHint')}
                </p>
              </div>
            )}

            {tab === 'summary' && (
              <div className="cost-control-mode__summary-panel">
                <div className="cost-control-mode__summary-card">
                  <div className="cost-control-mode__summary-label">{t('costControl.totalCalls')}</div>
                  <div className="cost-control-mode__summary-value">{totalCalls.toLocaleString()}</div>
                </div>
                {lastFetched && (
                  <p className="rd-text-muted cost-control-mode__last-updated">
                    {t('costControl.lastUpdated')}: {lastFetched.toLocaleString()}
                  </p>
                )}
                <ul className="cost-control-mode__summary-list">
                  {CATEGORIES.map((key) => (
                    <li key={key}>
                      {t('costControl.' + key)}: <strong>{(data[key] ?? 0).toLocaleString()}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </DesktopLayout>
  );
}
