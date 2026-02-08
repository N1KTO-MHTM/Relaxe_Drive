import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

type AnalyticsStats = {
  ordersCreated: number;
  ordersCompleted: number;
  byStatus: { SCHEDULED: number; ASSIGNED: number; IN_PROGRESS: number };
  heatmap: { zone: string; count: number }[];
};

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

export default function Analytics() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(() => {
    setError(null);
    setLoading(true);
    api
      .get<AnalyticsStats>(`/analytics/stats?from=${from}&to=${to}`)
      .then(setStats)
      .catch((err) => setError(err?.message || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="rd-page">
      <div className="rd-premium-panel">
        <div className="rd-panel-header">
          <h1>{t('analytics.title')}</h1>
        </div>
        <div className="analytics-filters" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <label>
            {t('analytics.from')}
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ marginLeft: '0.5rem' }}
            />
          </label>
          <label>
            {t('analytics.to')}
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ marginLeft: '0.5rem' }}
            />
          </label>
          <button type="button" className="rd-btn rd-btn-primary" onClick={fetchStats}>
            {t('analytics.apply')}
          </button>
          <button type="button" className="rd-btn rd-btn-secondary" onClick={fetchStats} disabled={loading}>
            {t('common.refresh')}
          </button>
        </div>
        {error && <p className="rd-error">{error}</p>}
        {loading && <p>{t('common.loading')}</p>}
        {!loading && !error && stats && (
          <>
            <div className="analytics-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="rd-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--rd-muted, #888)' }}>{t('analytics.ordersCreated')}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.ordersCreated}</div>
              </div>
              <div className="rd-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--rd-muted, #888)' }}>{t('analytics.ordersCompleted')}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.ordersCompleted}</div>
              </div>
              <div className="rd-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--rd-muted, #888)' }}>{t('analytics.scheduled')}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.byStatus.SCHEDULED}</div>
              </div>
              <div className="rd-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--rd-muted, #888)' }}>{t('analytics.assigned')}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.byStatus.ASSIGNED}</div>
              </div>
              <div className="rd-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--rd-muted, #888)' }}>{t('analytics.inProgress')}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.byStatus.IN_PROGRESS}</div>
              </div>
            </div>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>{t('analytics.heatmap')}</h3>
            <p className="rd-muted" style={{ marginBottom: '0.75rem' }}>{t('analytics.heatmapHint')}</p>
            {stats.heatmap.length === 0 ? (
              <p className="rd-muted">{t('analytics.noData')}</p>
            ) : (
              (() => {
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
                let maxCount = 0;
                for (const { zone, count } of stats.heatmap) {
                  const match = zone.match(/^(\w{3})\s+(\d{1,2})$/);
                  if (match) {
                    const dayIdx = dayNames.indexOf(match[1]);
                    const hour = parseInt(match[2], 10);
                    if (dayIdx >= 0 && dayIdx < 7 && hour >= 0 && hour < 24) {
                      grid[dayIdx][hour] += count;
                      if (grid[dayIdx][hour] > maxCount) maxCount = grid[dayIdx][hour];
                    }
                  }
                }
                return (
                  <div className="analytics-heatmap-grid" style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: 400 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left' }}></th>
                          {Array.from({ length: 24 }, (_, h) => (
                            <th key={h} style={{ padding: '0.25rem 2px', fontWeight: 500 }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dayNames.map((day, dayIdx) => (
                          <tr key={day}>
                            <td style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}>{day}</td>
                            {Array.from({ length: 24 }, (_, hour) => {
                              const value = grid[dayIdx][hour];
                              const intensity = maxCount > 0 ? value / maxCount : 0;
                              const bg = intensity > 0
                                ? `rgba(79, 114, 158, ${0.2 + 0.7 * intensity})`
                                : 'var(--rd-bg-elevated, #1e1e1e)';
                              return (
                                <td
                                  key={hour}
                                  style={{
                                    padding: 2,
                                    background: bg,
                                    minWidth: 18,
                                    textAlign: 'center',
                                    borderRadius: 2,
                                  }}
                                  title={`${day} ${hour}:00 — ${value}`}
                                >
                                  {value > 0 ? value : ''}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            )}
          </>
        )}
      </div>
    </div>
  );
}
