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
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<UserRow[]>('/users')
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load users');
        setUsers([]);
      })
      .finally(() => setLoading(false));
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

  return (
    <div className="rd-panel">
      <div className="rd-panel-header">
        <h1>{t('roles.title')}</h1>
      </div>
      <p className="rd-text-muted">{t('roles.admin')}, {t('roles.dispatcher')}, {t('roles.driver')} — {t('roles.usersList')}.</p>
      {error && <p className="rd-text-critical">{error}</p>}
      {loading ? (
        <p className="rd-text-muted">Loading…</p>
      ) : (
        <table className="roles-table" style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>{t('auth.nickname')}</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>{t('roles.admin')} / {t('roles.dispatcher')} / {t('roles.driver')}</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>{t('roles.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ padding: '0.5rem' }}>{u.nickname}</td>
                <td style={{ padding: '0.5rem' }}>
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
                <td style={{ padding: '0.5rem' }}>
                  <button
                    type="button"
                    className="rd-btn"
                    disabled={passwordResettingId === u.id}
                    onClick={() => handleResetPassword(u.id, u.nickname)}
                  >
                    {passwordResettingId === u.id ? '…' : t('roles.resetPassword')}
                  </button>
                  {updatingId === u.id && ` ${t('roles.saved')}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
