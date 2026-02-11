import { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import type { Role } from '../../store/auth';
import './Roles.css';

interface UserRow {
  id: string;
  nickname: string;
  email: string | null;
  phone: string | null;
  role: string;
  locale: string;
  createdAt: string;
  blocked?: boolean;
  bannedUntil?: string | null;
  banReason?: string | null;
  driverId?: string | null;
  carId?: string | null;
  carType?: string | null;
  carPlateNumber?: string | null;
}

const ROLES: Role[] = ['ADMIN', 'DISPATCHER', 'DRIVER'];

export default function Roles() {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [passwordResettingId, setPasswordResettingId] = useState<string | null>(null);
  const [resetLinkUserId, setResetLinkUserId] = useState<string | null>(null);
  const [generatedLinkFor, setGeneratedLinkFor] = useState<{ userId: string; link: string } | null>(null);
  const [error, setError] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterCarType, setFilterCarType] = useState('');
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserRow | null>(null);
  const [banModal, setBanModal] = useState<{ user: UserRow } | null>(null);
  const [banUntil, setBanUntil] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banForever, setBanForever] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'ADMIN';

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

  const filteredUsers = users.filter((u) => {
    const search = (filterSearch || '').trim().toLowerCase();
    if (search) {
      const match =
        (u.nickname || '').toLowerCase().includes(search) ||
        (u.email || '').toLowerCase().includes(search) ||
        (u.phone || '').toLowerCase().includes(search) ||
        (u.id || '').toLowerCase().includes(search) ||
        (u.driverId || '').toLowerCase().includes(search) || (u.carId || '').toLowerCase().includes(search);
      if (!match) return false;
    }
    if (filterRole && u.role !== filterRole) return false;
    if (filterCarType && (u.carType || '') !== filterCarType) return false;
    return true;
  });

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
      loadUsers();
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
        navigator.clipboard.writeText(res.link).catch(() => { });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate link');
    } finally {
      setResetLinkUserId(null);
    }
  }

  async function handleBlock(userId: string, blocked: boolean) {
    setBusyId(userId);
    try {
      await api.patch(`/users/${userId}/block`, { blocked });
      loadUsers();
    } catch {
      setError('Failed to update block status');
    } finally {
      setBusyId(null);
    }
  }

  function openBanModal(user: UserRow) {
    setBanModal({ user });
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setBanUntil(d.toISOString().slice(0, 16));
    setBanReason('');
    setBanForever(false);
  }

  async function handleBanSubmit() {
    if (!banModal) return;
    setBusyId(banModal.user.id);
    try {
      await api.patch(`/users/${banModal.user.id}/ban`, {
        forever: banForever || undefined,
        until: banForever ? undefined : new Date(banUntil).toISOString(),
        reason: banReason.trim() || undefined,
      });
      setBanModal(null);
      loadUsers();
    } catch {
      setError('Failed to ban user');
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnban(userId: string) {
    setBusyId(userId);
    try {
      await api.patch(`/users/${userId}/unban`, {});
      loadUsers();
    } catch {
      setError('Failed to unban');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(user: UserRow) {
    setDeleteConfirmUser(null);
    setBusyId(user.id);
    try {
      await api.delete(`/users/${user.id}`);
      loadUsers();
    } catch {
      setError('Failed to delete user');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rd-page">
      <div className="rd-premium-panel roles-panel">
        <div className="roles-header-row">
          <h1>{t('roles.title')}</h1>
          <p className="rd-text-muted">{t('roles.usersList')}</p>
          <button type="button" className="rd-btn rd-btn-secondary" onClick={loadUsers} disabled={loading}>
            {t('common.refresh')}
          </button>
        </div>
        {error && <p className="rd-text-critical" style={{ margin: '0 0 0.5rem' }}>{error}</p>}
        {!loading && (
          <div className="roles-search-bar">
            <input
              type="text"
              className="rd-input roles-search-input"
              placeholder={t('roles.filterSearch')}
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              aria-label={t('roles.filterSearch')}
            />
            <select
              className="rd-input"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="">{t('roles.filterRole')} —</option>
              <option value="ADMIN">{t('roles.admin')}</option>
              <option value="DISPATCHER">{t('roles.dispatcher')}</option>
              <option value="DRIVER">{t('roles.driver')}</option>
            </select>
            <select
              className="rd-input"
              value={filterCarType}
              onChange={(e) => setFilterCarType(e.target.value)}
            >
              <option value="">{t('roles.filterCarType')} —</option>
              <option value="SEDAN">{t('auth.carType_SEDAN')}</option>
              <option value="MINIVAN">{t('auth.carType_MINIVAN')}</option>
              <option value="SUV">{t('auth.carType_SUV')}</option>
            </select>
          </div>
        )}
        {loading ? (
          <p className="rd-text-muted">{t('common.loading')}</p>
        ) : filteredUsers.length === 0 ? (
          <p className="rd-text-muted">{users.length === 0 ? t('roles.noUsers') : t('roles.noUsers')}</p>
        ) : (
          <div className="roles-card-grid">
            {filteredUsers.map((u) => (
              <div key={u.id} className="roles-card rd-panel">
                <div className="roles-card-header">
                  <div className="roles-card-user-info">
                    <span className="roles-card-nickname">{u.nickname}</span>
                    <span className="roles-card-id-hint" title={u.id}>{u.id.substring(0, 8)}...</span>
                  </div>
                  {isAdmin && (
                    <div className="roles-card-status">
                      {u.blocked && <span className="rd-badge rd-badge-critical">{t('roles.blocked')}</span>}
                      {u.bannedUntil && new Date(u.bannedUntil) > new Date() && (
                        <span className="rd-badge rd-badge-critical" title={u.banReason ?? ''}>
                          {t('roles.bannedUntil')}
                        </span>
                      )}
                      {!u.blocked && (!u.bannedUntil || new Date(u.bannedUntil) <= new Date()) && (
                        <span className="rd-badge rd-badge-ok">{t('roles.active')}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="roles-card-body">
                  <div className="roles-card-row">
                    <div className="roles-card-field">
                      <label>{t('roles.phone')}</label>
                      <span>{u.phone ?? '—'}</span>
                    </div>
                    <div className="roles-card-field">
                      <label>{t('roles.email')}</label>
                      <span className="roles-cell-email">{u.email ? <a href={`mailto:${u.email}`}>{u.email}</a> : '—'}</span>
                    </div>
                  </div>

                  <div className="roles-card-row">
                    <div className="roles-card-field">
                      <label>{t('roles.role')}</label>
                      <select
                        className="rd-input roles-select-role"
                        value={u.role}
                        disabled={updatingId === u.id || (isAdmin && u.id === currentUser?.id)}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{t('roles.' + r.toLowerCase())}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {u.role === 'DRIVER' && (
                    <div className="roles-card-driver-info">
                      <div className="roles-card-row">
                        <div className="roles-card-field">
                          <label>{t('roles.driverId')}</label>
                          <span>{u.driverId ?? '—'}</span>
                        </div>
                        <div className="roles-card-field">
                          <label>{t('roles.carId')}</label>
                          <span>{u.carId ?? '—'}</span>
                        </div>
                      </div>
                      <div className="roles-card-row">
                        <div className="roles-card-field">
                          <label>{t('roles.carType')}</label>
                          <span>{u.carType ? t('auth.carType_' + u.carType) : '—'}</span>
                        </div>
                        <div className="roles-card-field">
                          <label>{t('roles.carPlateNumber')}</label>
                          <span>{u.carPlateNumber ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="roles-card-footer">
                  <div className="roles-actions-grid">
                    <button
                      type="button"
                      className="rd-btn"
                      disabled={passwordResettingId === u.id}
                      onClick={() => handleResetPassword(u.id, u.nickname)}
                    >
                      {passwordResettingId === u.id ? '…' : t('roles.resetPassword')}
                    </button>
                    <button
                      type="button"
                      className="rd-btn"
                      disabled={resetLinkUserId === u.id}
                      onClick={() => handleGenerateResetLink(u.id)}
                      title={t('roles.resetLinkTitle')}
                    >
                      {resetLinkUserId === u.id ? '…' : t('roles.resetLink')}
                    </button>
                    {isAdmin && u.id !== currentUser?.id && (
                      <>
                        {u.blocked ? (
                          <button type="button" className="rd-btn" disabled={!!busyId} onClick={() => handleBlock(u.id, false)}>
                            {t('roles.unblock')}
                          </button>
                        ) : (
                          <button type="button" className="rd-btn rd-btn-danger" disabled={!!busyId} onClick={() => handleBlock(u.id, true)}>
                            {t('roles.block')}
                          </button>
                        )}
                        {u.bannedUntil && new Date(u.bannedUntil) > new Date() ? (
                          <button type="button" className="rd-btn" disabled={!!busyId} onClick={() => handleUnban(u.id)}>
                            {t('roles.unban')}
                          </button>
                        ) : (
                          <button type="button" className="rd-btn" disabled={!!busyId} onClick={() => openBanModal(u)}>
                            {t('roles.ban')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="rd-btn rd-btn-danger"
                          disabled={!!busyId}
                          onClick={() => setDeleteConfirmUser(u)}
                          title={t('roles.delete')}
                        >
                          {t('roles.delete')}
                        </button>
                      </>
                    )}
                  </div>
                  {generatedLinkFor?.userId === u.id && (
                    <div className="roles-card-reset-link">
                      {t('roles.resetLinkCopied')}: <a href={generatedLinkFor.link} target="_blank" rel="noopener noreferrer">{generatedLinkFor.link}</a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteConfirmUser && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div className="rd-premium-panel" style={{ maxWidth: 400, width: '100%' }}>
            <h3>{t('roles.delete')}: {deleteConfirmUser.nickname}</h3>
            <p className="rd-text-muted" style={{ marginTop: 8 }}>{t('roles.deleteConfirm')}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="rd-btn rd-btn-danger"
                disabled={!!busyId}
                onClick={() => handleDelete(deleteConfirmUser)}
              >
                {busyId === deleteConfirmUser.id ? '…' : t('roles.delete')}
              </button>
              <button type="button" className="rd-btn" onClick={() => setDeleteConfirmUser(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {banModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div className="rd-premium-panel" style={{ maxWidth: 400, width: '100%' }}>
            <h3>{t('roles.banUser')}: {banModal.user.nickname}</h3>
            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={banForever} onChange={(e) => setBanForever(e.target.checked)} />
                <span>{t('roles.banForever')}</span>
              </label>
              {!banForever && (
                <>
                  <label>{t('roles.banUntil')}</label>
                  <input
                    type="datetime-local"
                    className="rd-input"
                    value={banUntil}
                    onChange={(e) => setBanUntil(e.target.value)}
                    style={{ width: '100%', marginBottom: '0.75rem' }}
                  />
                </>
              )}
              <label>{t('roles.banReason')}</label>
              <input
                type="text"
                className="rd-input"
                placeholder={t('roles.banReasonPlaceholder')}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" className="rd-btn rd-btn-primary" disabled={!!busyId} onClick={handleBanSubmit}>
                {busyId === banModal.user.id ? '…' : t('roles.ban')}
              </button>
              <button type="button" className="rd-btn" onClick={() => setBanModal(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
