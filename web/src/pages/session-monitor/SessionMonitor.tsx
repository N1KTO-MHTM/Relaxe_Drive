import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import Pagination, { paginate, DEFAULT_PAGE_SIZE } from '../../components/Pagination';

interface SessionRow {
  id: string;
  userId: string;
  device: string | null;
  ip: string | null;
  lastActiveAt: string;
  createdAt: string;
  user: { nickname: string; role: string; phone?: string | null };
}

interface AccountRow {
  id: string;
  nickname: string;
  phone: string | null;
  role: string;
  createdAt: string;
  hasActiveSession: boolean;
  lastActiveAt: string | null;
  device: string | null;
  ip: string | null;
}

export default function SessionMonitor() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [tab, setTab] = useState<'sessions' | 'accounts'>('sessions');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [accountsSearch, setAccountsSearch] = useState('');
  const [accountsRoleFilter, setAccountsRoleFilter] = useState('');
  const [accountsStatusFilter, setAccountsStatusFilter] = useState<'all' | 'active' | 'offline'>('all');

  const filteredAccounts = useMemo(() => {
    let list = accounts;
    if (accountsSearch.trim()) {
      const q = accountsSearch.trim().toLowerCase();
      list = list.filter(
        (a) =>
          (a.nickname ?? '').toLowerCase().includes(q) ||
          (a.phone ?? '').toLowerCase().includes(q),
      );
    }
    if (accountsRoleFilter) {
      list = list.filter((a) => a.role === accountsRoleFilter);
    }
    if (accountsStatusFilter === 'active') list = list.filter((a) => a.hasActiveSession);
    if (accountsStatusFilter === 'offline') list = list.filter((a) => !a.hasActiveSession);
    return list;
  }, [accounts, accountsSearch, accountsRoleFilter, accountsStatusFilter]);

  const paginatedSessions = useMemo(
    () => paginate(sessions, page, DEFAULT_PAGE_SIZE),
    [sessions, page],
  );
  const paginatedAccounts = useMemo(
    () => paginate(filteredAccounts, page, DEFAULT_PAGE_SIZE),
    [filteredAccounts, page],
  );

  function fetchSessions(silent = false) {
    if (!silent) setError(null);
    api
      .get<SessionRow[]>('/users/sessions')
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => { if (!silent) setLoading(false); });
  }

  function fetchAccounts(silent = false) {
    if (!silent) setError(null);
    api
      .get<AccountRow[]>('/users/with-session-status')
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => { if (!silent) setLoading(false); });
  }

  useEffect(() => {
    setLoading(true);
    if (tab === 'sessions') fetchSessions(false);
    else if (isAdmin) fetchAccounts(false);
    else setLoading(false);
  }, [tab, isAdmin]);

  useEffect(() => {
    if (tab !== 'sessions') return;
    const interval = setInterval(() => fetchSessions(true), 30_000);
    return () => clearInterval(interval);
  }, [tab]);

  useEffect(() => {
    if (tab !== 'accounts' || !isAdmin) return;
    const interval = setInterval(() => fetchAccounts(true), 30_000);
    return () => clearInterval(interval);
  }, [tab, isAdmin]);

  useEffect(() => {
    setPage(1);
  }, [accountsSearch, accountsRoleFilter, accountsStatusFilter, tab]);

  return (
    <div className="rd-page">
      <div className="rd-panel">
        <div className="rd-panel-header">
          <h1>{t('sessions.title')}</h1>
        </div>
        <p className="rd-text-muted">
          {t('sessions.online')}, {t('sessions.device')}, {t('sessions.ip')}, {t('sessions.lastActive')}.
        </p>

        {isAdmin && (
          <div className="sessions-tabs" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', marginBottom: '0.5rem' }}>
            <button
              type="button"
              className={`rd-btn ${tab === 'sessions' ? 'rd-btn-primary' : ''}`}
              onClick={() => setTab('sessions')}
            >
              {t('sessions.tabSessions')}
            </button>
            <button
              type="button"
              className={`rd-btn ${tab === 'accounts' ? 'rd-btn-primary' : ''}`}
              onClick={() => setTab('accounts')}
            >
              {t('sessions.tabAccounts')}
            </button>
          </div>
        )}

        {loading && <p className="rd-text-muted">Loading…</p>}
        {error && <p className="rd-text-critical">{error}</p>}

        {tab === 'sessions' && !loading && !error && (
          <>
            {sessions.length === 0 ? (
              <p className="rd-text-muted">No sessions.</p>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table className="rd-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>{t('sessions.online')}</th>
                      <th>{t('sessions.user')}</th>
                      <th>{t('sessions.phone')}</th>
                      <th>{t('sessions.device')}</th>
                      <th>{t('sessions.ip')}</th>
                      <th>{t('sessions.lastActive')}</th>
                      {isAdmin && <th style={{ width: 100 }}>{t('sessions.actions')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSessions.map((s) => (
                      <tr key={s.id}>
                        <td><span className="rd-badge rd-badge-ok">Online</span></td>
                        <td>
                          {s.user?.nickname ?? s.userId}{' '}
                          {s.user?.role && <span className="rd-text-muted">({s.user.role})</span>}
                        </td>
                        <td>{s.user?.phone ?? '—'}</td>
                        <td>{s.device ?? '—'}</td>
                        <td>{s.ip ?? '—'}</td>
                        <td>{s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString() : '—'}</td>
                        {isAdmin && (
                          <td>
                            <button
                              type="button"
                              className="rd-btn"
                              disabled={revokingId === s.id}
                              onClick={() => {
                                if (!window.confirm(t('sessions.endSessionConfirm'))) return;
                                setRevokingId(s.id);
                                api.delete(`/users/sessions/${s.id}`)
                                  .then(() => fetchSessions(true))
                                  .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
                                  .finally(() => setRevokingId(null));
                              }}
                            >
                              {revokingId === s.id ? '…' : t('sessions.endSession')}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination page={page} totalItems={sessions.length} onPageChange={setPage} />
              </div>
            )}
          </>
        )}

        {tab === 'accounts' && isAdmin && !loading && !error && (
          <>
            <div className="sessions-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginTop: '1rem' }}>
              <input
                type="text"
                className="rd-input"
                placeholder={t('sessions.searchPlaceholder')}
                value={accountsSearch}
                onChange={(e) => setAccountsSearch(e.target.value)}
                style={{ minWidth: 200 }}
              />
              <select
                className="rd-input"
                value={accountsRoleFilter}
                onChange={(e) => setAccountsRoleFilter(e.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="">{t('sessions.allRoles')}</option>
                <option value="ADMIN">{t('roles.admin')}</option>
                <option value="DISPATCHER">{t('roles.dispatcher')}</option>
                <option value="DRIVER">{t('roles.driver')}</option>
              </select>
              <select
                className="rd-input"
                value={accountsStatusFilter}
                onChange={(e) => setAccountsStatusFilter(e.target.value as 'all' | 'active' | 'offline')}
                style={{ width: 'auto' }}
              >
                <option value="all">{t('sessions.allStatuses')}</option>
                <option value="active">{t('sessions.active')}</option>
                <option value="offline">{t('sessions.offline')}</option>
              </select>
            </div>
            {filteredAccounts.length === 0 ? (
              <p className="rd-text-muted" style={{ marginTop: '1rem' }}>{t('sessions.noAccounts')}</p>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table className="rd-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>{t('sessions.user')}</th>
                      <th>{t('sessions.phone')}</th>
                      <th>{t('sessions.role')}</th>
                      <th>{t('sessions.status')}</th>
                      <th>{t('sessions.lastActive')}</th>
                      <th>{t('sessions.device')}</th>
                      <th>{t('sessions.ip')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAccounts.map((a) => (
                      <tr key={a.id}>
                        <td><strong>{a.nickname}</strong></td>
                        <td>{a.phone ?? '—'}</td>
                        <td><span className="rd-text-muted">{a.role}</span></td>
                        <td>
                          <span className={`rd-badge ${a.hasActiveSession ? 'rd-badge-ok' : ''}`}>
                            {a.hasActiveSession ? t('sessions.active') : t('sessions.offline')}
                          </span>
                        </td>
                        <td>{a.lastActiveAt ? new Date(a.lastActiveAt).toLocaleString() : '—'}</td>
                        <td>{a.device ?? '—'}</td>
                        <td>{a.ip ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination page={page} totalItems={filteredAccounts.length} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
