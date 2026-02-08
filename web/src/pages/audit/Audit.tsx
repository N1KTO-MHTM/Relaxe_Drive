import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

interface AuditRow {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  payload: string;
  ip: string | null;
  createdAt: string;
  user: { nickname: string; role: string; phone: string | null } | null;
}

export default function Audit() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [resource, setResource] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState('100');

  const fetchAudit = useCallback((silent = false) => {
    if (!silent) setError(null);
    const params = new URLSearchParams();
    if (userId.trim()) params.set('userId', userId.trim());
    if (action.trim()) params.set('action', action.trim());
    if (resource.trim()) params.set('resource', resource.trim());
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (limit) params.set('limit', limit);
    const q = params.toString();
    api
      .get<AuditRow[]>(`/audit${q ? `?${q}` : ''}`)
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => { if (!silent) setLoading(false); });
  }, [userId, action, resource, from, to, limit]);

  useEffect(() => {
    setLoading(true);
    fetchAudit(false);
  }, [fetchAudit]);

  return (
    <div className="rd-page">
      <div className="rd-premium-panel">
        <div className="rd-panel-header">
          <h1>{t('audit.title')}</h1>
        </div>
        <p className="rd-text-muted">{t('audit.subtitle')}</p>

        <div className="audit-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="rd-text-muted" style={{ fontSize: '0.85rem' }}>{t('audit.userId')}</span>
            <input
              type="text"
              className="rd-input"
              placeholder="ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              style={{ minWidth: '120px' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="rd-text-muted" style={{ fontSize: '0.85rem' }}>{t('audit.action')}</span>
            <input
              type="text"
              className="rd-input"
              placeholder="e.g. auth.login"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              style={{ minWidth: '140px' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="rd-text-muted" style={{ fontSize: '0.85rem' }}>{t('audit.resource')}</span>
            <input
              type="text"
              className="rd-input"
              placeholder="e.g. order, user"
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              style={{ minWidth: '100px' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="rd-text-muted" style={{ fontSize: '0.85rem' }}>{t('audit.from')}</span>
            <input
              type="datetime-local"
              className="rd-input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="rd-text-muted" style={{ fontSize: '0.85rem' }}>{t('audit.to')}</span>
            <input
              type="datetime-local"
              className="rd-input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="rd-text-muted" style={{ fontSize: '0.85rem' }}>{t('audit.limit')}</span>
            <select
              className="rd-input"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              style={{ minWidth: '80px' }}
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </label>
          <button type="button" className="rd-btn rd-btn-primary" onClick={() => { setLoading(true); fetchAudit(false); }}>
            {t('analytics.apply')}
          </button>
        </div>

        {error && <p className="rd-error">{error}</p>}
        {loading && <p>{t('analytics.loading')}</p>}
        {!loading && !error && (
          <div className="audit-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="rd-table" style={{ width: '100%', minWidth: 700 }}>
              <thead>
                <tr>
                  <th>{t('audit.time')}</th>
                  <th>{t('audit.user')}</th>
                  <th>{t('audit.action')}</th>
                  <th>{t('audit.resource')}</th>
                  <th>{t('audit.payload')}</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="rd-text-muted">{t('audit.noData')}</td></tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(row.createdAt).toLocaleString()}</td>
                      <td>{row.user ? `${row.user.nickname} (${row.user.role})` : row.userId || '—'}</td>
                      <td><code style={{ fontSize: '0.85em' }}>{row.action}</code></td>
                      <td>{row.resource}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.payload}>
                        {row.payload ? (row.payload.length > 60 ? row.payload.slice(0, 60) + '…' : row.payload) : '—'}
                      </td>
                      <td>{row.ip || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
