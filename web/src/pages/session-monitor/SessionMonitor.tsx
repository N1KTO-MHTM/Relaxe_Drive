import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

interface SessionRow {
  id: string;
  userId: string;
  device: string | null;
  ip: string | null;
  lastActiveAt: string;
  createdAt: string;
  user: { nickname: string; role: string };
}

export default function SessionMonitor() {
  const { t } = useTranslation();
  const [list, setList] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function fetchSessions(silent = false) {
    if (!silent) setError(null);
    api
      .get<SessionRow[]>('/users/sessions')
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => { if (!silent) setLoading(false); });
  }

  useEffect(() => {
    setLoading(true);
    fetchSessions(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => fetchSessions(true), 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rd-page">
      <div className="rd-panel">
      <div className="rd-panel-header">
        <h1>{t('sessions.title')}</h1>
      </div>
      <p className="rd-text-muted">{t('sessions.online')}, {t('sessions.device')}, {t('sessions.ip')}, {t('sessions.lastActive')}.</p>
      {loading && <p className="rd-text-muted">Loading…</p>}
      {error && <p className="rd-text-critical">{error}</p>}
      {!loading && !error && list.length === 0 && (
        <p className="rd-text-muted">No sessions.</p>
      )}
      {!loading && !error && list.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
          <table className="rd-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>{t('sessions.online')}</th>
                <th>User</th>
                <th>{t('sessions.device')}</th>
                <th>{t('sessions.ip')}</th>
                <th>{t('sessions.lastActive')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td><span className="rd-badge rd-badge-ok">Online</span></td>
                  <td>{s.user?.nickname ?? s.userId} {s.user?.role && <span className="rd-text-muted">({s.user.role})</span>}</td>
                  <td>{s.device ?? '—'}</td>
                  <td>{s.ip ?? '—'}</td>
                  <td>{s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}
