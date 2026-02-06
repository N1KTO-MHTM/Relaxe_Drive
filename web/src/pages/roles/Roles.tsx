import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { Role } from '../../store/auth';

interface UserRow {
  id: string;
  nickname: string;
  email: string | null;
  role: string;
  locale: string;
  createdAt: string;
}

const ROLES: Role[] = ['ADMIN', 'DISPATCHER', 'DRIVER'];

export default function Roles() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [passwordResettingId, setPasswordResettingId] = useState<string | null>(null);
  const [resetLinkUserId, setResetLinkUserId] = useState<string | null>(null);
  const [generatedLinkFor, setGeneratedLinkFor] = useState<{ userId: string; link: string } | null>(null);
  const [error, setError] = useState('');

  function loadUsers() {
    setLoading(true);
    setError('');
    api.get<UserRow[]>('/users')
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load users');
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleRoleChange(userId: string, role: Role) {
    setUpdatingId(userId);
    setError('');
    try {
      await api.patch(`/users/${userId}/role`, { role });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update role');
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleResetPassword(userId: string, nickname: string) {
    const newPassword = window.prompt(t('roles.resetPasswordPrompt', { nickname }));
    if (!newPassword || newPassword.length < 6) {
      if (newPassword !== null) setError(t('roles.passwordMinLength'));
      return;
    }
    setPasswordResettingId(userId);
    setError('');
    try {
      await api.patch(`/users/${userId}/password`, { password: newPassword });
      setUsers((prev) => prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset password');
    } finally {
      setPasswordResettingId(null);
    }
  }

  async function handleGenerateResetLink(userId: string) {
    setResetLinkUserId(userId);
    setGeneratedLinkFor(null);
    setError('');
    try {
      const res = await api.post<{ token: string; link: string }>('/auth/admin/generate-reset-token', { userId });
      setGeneratedLinkFor({ userId, link: res.link });
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(res.link).catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate link');
    } finally {
      setResetLinkUserId(null);
    }
  }

  return (
    <div className="rd-page">
      <div className="rd-panel">
      <div className="rd-panel-header">
        <h1>{t('roles.title')}</h1>
        <button type="button" className="rd-btn rd-btn-secondary" onClick={loadUsers} disabled={loading}>
          {t('common.refresh')}
        </button>
      </div>
      <p className="rd-text-muted">{t('roles.admin')}, {t('roles.dispatcher')}, {t('roles.driver')} — {t('roles.usersList')}.</p>
      {error && <p className="rd-text-critical">{error}</p>}
      {loading ? (
        <p className="rd-text-muted">{t('common.loading')}</p>
      ) : (
        <div className="rd-table-wrapper">
        <table className="rd-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>{t('auth.nickname')}</th>
              <th>{t('roles.admin')} / {t('roles.dispatcher')} / {t('roles.driver')}</th>
              <th>{t('roles.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.nickname}</td>
                <td>
                  <select
                    className="rd-input"
                    value={u.role}
                    disabled={updatingId === u.id}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{t('roles.' + r.toLowerCase())}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="rd-btn"
                    disabled={passwordResettingId === u.id}
                    onClick={() => handleResetPassword(u.id, u.nickname)}
                  >
                    {passwordResettingId === u.id ? '…' : t('roles.resetPassword')}
                  </button>
                  {' '}
                  <button
                    type="button"
                    className="rd-btn"
                    disabled={resetLinkUserId === u.id}
                    onClick={() => handleGenerateResetLink(u.id)}
                    title={t('roles.resetLinkTitle')}
                  >
                    {resetLinkUserId === u.id ? '…' : t('roles.resetLink')}
                  </button>
                  {generatedLinkFor?.userId === u.id && (
                    <div style={{ marginTop: 8, fontSize: '0.85rem', wordBreak: 'break-all' }}>
                      {t('roles.resetLinkCopied')}: <a href={generatedLinkFor.link} target="_blank" rel="noopener noreferrer">{generatedLinkFor.link}</a>
                    </div>
                  )}
                  {updatingId === u.id && ` ${t('roles.saved')}`}
                </td>
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
