import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import DesktopLayout from '../layouts/DesktopLayout';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';

type LogTab = 'all' | 'auth' | 'order' | 'user';

interface AuditEntry {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  payload: string;
  ip: string | null;
  createdAt: string;
  user?: { nickname: string; role: string; phone?: string | null } | null;
}

const TABS: { key: LogTab; resource?: string }[] = [
  { key: 'all' },
  { key: 'auth', resource: 'session' },
  { key: 'order', resource: 'order' },
  { key: 'user', resource: 'user' },
];

const AUTO_EXPORT_INTERVAL_MS = 5 * 60 * 1000;

function parsePayload(payload: string): { device?: string; phone?: string } | null {
  if (!payload?.trim()) return null;
  try {
    return JSON.parse(payload) as { device?: string; phone?: string };
  } catch {
    return null;
  }
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Timeline, filters, export CSV/JSON, auto-export. */
export default function LogsAuditMode() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<LogTab>('all');
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoExport, setAutoExport] = useState(false);

  const resourceFilter = TABS.find((x) => x.key === tab)?.resource;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (resourceFilter) params.set('resource', resourceFilter);
      params.set('limit', '200');
      const data = await api.get<AuditEntry[]>(`/audit?${params.toString()}`);
      setLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('403') || msg.includes('Forbidden')) {
        setError('accessDenied');
        setLogs([]);
      } else {
        setError(msg || 'Failed to load');
        setLogs([]);
      }
    } finally {
      setLoading(false);
    }
  }, [resourceFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!autoExport || logs.length === 0) return;
    const run = () => {
      const rows = logs.map((l) => {
        const p = parsePayload(l.payload);
        return {
          time: l.createdAt,
          user: l.user?.nickname ?? l.userId ?? '',
          device: p?.device ?? '',
          phone: l.user?.phone ?? p?.phone ?? '',
          action: l.action,
          resource: l.resource,
          payload: l.payload,
        };
      });
      const json = JSON.stringify(rows, null, 2);
      const name = `relaxdrive-audit-${new Date().toISOString().slice(0, 10)}.json`;
      downloadFile(json, name, 'application/json');
    };
    run();
    const id = setInterval(run, AUTO_EXPORT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoExport, logs]);

  const handleExport = () => {
    const rows = logs.map((l) => {
      const p = parsePayload(l.payload);
      return {
        time: l.createdAt,
        user: l.user?.nickname ?? l.userId ?? '',
        device: p?.device ?? '',
        phone: l.user?.phone ?? p?.phone ?? '',
        action: l.action,
        resource: l.resource,
        payload: l.payload,
      };
    });
    const json = JSON.stringify(rows, null, 2);
    downloadFile(json, `relaxdrive-audit-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };

  const canAccessAudit = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';

  return (
    <DesktopLayout>
      <div className="logs-mode">
        <div className="rd-panel">
          <div className="rd-panel-header">
            <h1>{t('logs.title')}</h1>
            <div className="logs-mode__actions">
              {canAccessAudit && (
                <>
                  <label className="logs-mode__auto">
                    <input type="checkbox" checked={autoExport} onChange={(e) => setAutoExport(e.target.checked)} />
                    <span>{t('logs.exportAuto')}</span>
                  </label>
                  <button type="button" className="rd-btn rd-btn-primary" onClick={handleExport}>
                    {t('logs.export')}
                  </button>
                  <button type="button" className="rd-btn rd-btn-secondary" onClick={() => loadLogs()} disabled={loading}>
                    {t('common.refresh')}
                  </button>
                </>
              )}
            </div>
          </div>

          {canAccessAudit && (
            <>
              <div className="logs-mode__tabs">
                {TABS.map(({ key }) => (
                  <button
                    key={key}
                    type="button"
                    className={`rd-btn ${tab === key ? 'rd-btn-primary' : ''}`}
                    onClick={() => setTab(key)}
                  >
                    {t(key === 'all' ? 'logs.tabAll' : key === 'auth' ? 'logs.tabAuth' : key === 'order' ? 'logs.tabOrders' : 'logs.tabUsers')}
                  </button>
                ))}
              </div>

              {error === 'accessDenied' && <p className="logs-mode__error">{t('logs.accessDenied')}</p>}
              {error && error !== 'accessDenied' && <p className="logs-mode__error">{error}</p>}
              {loading && <p className="logs-mode__muted">{t('common.loading')}</p>}
              {!loading && !error && logs.length === 0 && <p className="logs-mode__muted">{t('logs.noData')}</p>}
              {!loading && logs.length > 0 && (
                <div className="logs-mode__table-wrap">
                  <table className="logs-mode__table">
                    <thead>
                      <tr>
                        <th>{t('logs.time')}</th>
                        <th>{t('logs.user')}</th>
                        <th>{t('logs.device')}</th>
                        <th>{t('logs.phone')}</th>
                        <th>{t('logs.action')}</th>
                        <th>{t('logs.resource')}</th>
                        <th>{t('logs.payload')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((l) => {
                        const p = parsePayload(l.payload);
                        return (
                          <tr key={l.id}>
                            <td>{new Date(l.createdAt).toLocaleString()}</td>
                            <td>{l.user?.nickname ?? l.userId ?? '—'}</td>
                            <td>{p?.device ?? '—'}</td>
                            <td>{l.user?.phone ?? p?.phone ?? '—'}</td>
                            <td>{l.action}</td>
                            <td>{l.resource}</td>
                            <td className="logs-mode__payload">{l.payload || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {!canAccessAudit && <p className="logs-mode__error">{t('logs.accessDenied')}</p>}
        </div>
      </div>
    </DesktopLayout>
  );
}
