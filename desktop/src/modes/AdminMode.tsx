import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import DesktopLayout from '../layouts/DesktopLayout';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';

type Role = 'ADMIN' | 'DISPATCHER' | 'DRIVER';

interface UserRow {
  id: string;
  nickname: string;
  email: string | null;
  phone: string | null;
  role: string;
  blocked: boolean;
  bannedUntil: string | null;
  banReason: string | null;
  createdAt: string;
  driverId?: string | null;
  carType?: string | null;
  carPlateNumber?: string | null;
}

export default function AdminMode() {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banModal, setBanModal] = useState<{ user: UserRow } | null>(null);
  const [banUntil, setBanUntil] = useState('');
  const [banReason, setBanReason] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterCarType, setFilterCarType] = useState('');
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserRow | null>(null);

  const loadUsers = () => {
    setLoading(true);
    setError(null);
    api
      .get<UserRow[]>('/users')
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const setUser = useAuthStore((s) => s.setUser);

  const handleRoleChange = async (userId: string, role: string) => {
    if (!role) return;
    setBusyId(userId);
    try {
      await api.patch(`/users/${userId}/role`, { role });
      loadUsers();
      // Sync role on this client (and on web via WebSocket) — refetch current user
      api.get<{ id: string; nickname: string; role: string; locale: string }>('/users/me').then(setUser).catch(() => {});
    } catch {
      // keep state
    } finally {
      setBusyId(null);
    }
  };

  const handleBlock = async (userId: string, blocked: boolean) => {
    setBusyId(userId);
    try {
      await api.patch(`/users/${userId}/block`, { blocked });
      loadUsers();
    } catch {
      // keep state
    } finally {
      setBusyId(null);
    }
  };

  const openBanModal = (user: UserRow) => {
    setBanModal({ user });
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setBanUntil(d.toISOString().slice(0, 16));
    setBanReason('');
  };

  const handleBanSubmit = async () => {
    if (!banModal) return;
    setBusyId(banModal.user.id);
    try {
      await api.patch(`/users/${banModal.user.id}/ban`, {
        until: new Date(banUntil).toISOString(),
        reason: banReason.trim() || undefined,
      });
      setBanModal(null);
      loadUsers();
    } catch {
      // keep modal
    } finally {
      setBusyId(null);
    }
  };

  const handleUnban = async (userId: string) => {
    setBusyId(userId);
    try {
      await api.patch(`/users/${userId}/unban`);
      loadUsers();
    } catch {
      // keep state
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (user: UserRow) => {
    setDeleteConfirmUser(null);
    setBusyId(user.id);
    try {
      await api.delete(`/users/${user.id}`);
      loadUsers();
    } catch {
      // keep state
    } finally {
      setBusyId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const search = (filterSearch || '').trim().toLowerCase();
    if (search) {
      const match =
        u.nickname.toLowerCase().includes(search) ||
        (u.id || '').toLowerCase().includes(search) ||
        (u.driverId || '').toLowerCase().includes(search) ||
        (u.phone || '').includes(filterSearch.trim());
      if (!match) return false;
    }
    if (filterRole && u.role !== filterRole) return false;
    if (filterCarType && (u.carType || '') !== filterCarType) return false;
    return true;
  });

  const isAdmin = currentUser?.role === 'ADMIN';
  if (!isAdmin) {
    return (
      <DesktopLayout>
        <div className="rd-panel">
          <p className="logs-mode__error">{t('admin.accessDenied')}</p>
        </div>
      </DesktopLayout>
    );
  }

  return (
    <DesktopLayout>
      <div className="admin-mode">
        <div className="rd-panel">
          <div className="rd-panel-header">
            <h1>{t('admin.title')}</h1>
            <button type="button" className="rd-btn rd-btn-secondary" onClick={loadUsers} disabled={loading}>
              {t('common.refresh')}
            </button>
          </div>
          <p className="rd-text-muted" style={{ marginBottom: '1rem' }}>{t('admin.subtitle')}</p>
          {error && <p className="logs-mode__error">{error}</p>}
          {!loading && users.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
              <input
                type="text"
                className="rd-input"
                placeholder={t('admin.filterSearch')}
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                style={{ minWidth: 160 }}
              />
              <select
                className="rd-input"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                style={{ minWidth: 120 }}
              >
                <option value="">{t('admin.filterRole')} —</option>
                <option value="ADMIN">{t('roles.admin')}</option>
                <option value="DISPATCHER">{t('roles.dispatcher')}</option>
                <option value="DRIVER">{t('roles.driver')}</option>
              </select>
              <select
                className="rd-input"
                value={filterCarType}
                onChange={(e) => setFilterCarType(e.target.value)}
                style={{ minWidth: 120 }}
              >
                <option value="">{t('admin.filterCarType')} —</option>
                <option value="SEDAN">{t('auth.carType_SEDAN')}</option>
                <option value="MINIVAN">{t('auth.carType_MINIVAN')}</option>
                <option value="SUV">{t('auth.carType_SUV')}</option>
              </select>
            </div>
          )}
          {loading && <p className="logs-mode__muted">{t('common.loading')}</p>}
          {!loading && users.length === 0 && <p className="logs-mode__muted">{t('admin.noUsers')}</p>}
          {!loading && filteredUsers.length > 0 && (
            <div className="logs-mode__table-wrap">
              <table className="logs-mode__table">
                <thead>
                  <tr>
                    <th>{t('admin.nickname')}</th>
                    <th>{t('admin.phone')}</th>
                    <th>{t('admin.role')}</th>
                    <th>{t('admin.driverId')}</th>
                    <th>{t('admin.carType')}</th>
                    <th>{t('admin.carPlateNumber')}</th>
                    <th>{t('admin.status')}</th>
                    <th>{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.nickname}</td>
                      <td>{u.phone ?? '—'}</td>
                      <td>
                        <select
                          className="rd-input"
                          value={u.role}
                          disabled={busyId === u.id || u.id === currentUser?.id}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        >
                          <option value="ADMIN">{t('roles.admin')}</option>
                          <option value="DISPATCHER">{t('roles.dispatcher')}</option>
                          <option value="DRIVER">{t('roles.driver')}</option>
                        </select>
                      </td>
                      <td>{u.role === 'DRIVER' ? (u.driverId ?? '—') : '—'}</td>
                      <td>{u.role === 'DRIVER' ? (u.carType ? t('auth.carType_' + u.carType) : '—') : '—'}</td>
                      <td>{u.carPlateNumber ?? '—'}</td>
                      <td>
                        {u.blocked && <span className="rd-badge rd-badge-critical">{t('admin.blocked')}</span>}
                        {u.bannedUntil && new Date(u.bannedUntil) > new Date() && (
                          <span className="rd-badge rd-badge-critical" title={u.banReason ?? ''}>
                            {t('admin.bannedUntil')} {new Date(u.bannedUntil).toLocaleString()}
                          </span>
                        )}
                        {!u.blocked && (!u.bannedUntil || new Date(u.bannedUntil) <= new Date()) && (
                          <span className="rd-badge rd-badge-ok">{t('admin.active')}</span>
                        )}
                      </td>
                      <td>
                        {u.id !== currentUser?.id && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {u.blocked ? (
                              <button
                                type="button"
                                className="rd-btn"
                                disabled={!!busyId}
                                onClick={() => handleBlock(u.id, false)}
                              >
                                {t('admin.unblock')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="rd-btn rd-btn-danger"
                                disabled={!!busyId}
                                onClick={() => handleBlock(u.id, true)}
                              >
                                {t('admin.block')}
                              </button>
                            )}
                            {u.bannedUntil && new Date(u.bannedUntil) > new Date() ? (
                              <button
                                type="button"
                                className="rd-btn"
                                disabled={!!busyId}
                                onClick={() => handleUnban(u.id)}
                              >
                                {t('admin.unban')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="rd-btn"
                                disabled={!!busyId}
                                onClick={() => openBanModal(u)}
                              >
                                {t('admin.ban')}
                              </button>
                            )}
                            <button
                              type="button"
                              className="rd-btn rd-btn-danger"
                              disabled={!!busyId}
                              onClick={() => setDeleteConfirmUser(u)}
                              title={t('admin.delete')}
                            >
                              {t('admin.delete')}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && users.length > 0 && filteredUsers.length === 0 && (
            <p className="logs-mode__muted">{t('admin.noUsers')}</p>
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
            <div className="rd-panel" style={{ maxWidth: 400, width: '100%' }}>
              <h3>{t('admin.delete')}: {deleteConfirmUser.nickname}</h3>
              <p className="rd-text-muted" style={{ marginTop: 8 }}>{t('admin.deleteConfirm')}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="rd-btn rd-btn-danger"
                  disabled={!!busyId}
                  onClick={() => handleDelete(deleteConfirmUser)}
                >
                  {busyId === deleteConfirmUser.id ? '…' : t('admin.delete')}
                </button>
                <button type="button" className="rd-btn" onClick={() => setDeleteConfirmUser(null)}>
                  {t('admin.cancel')}
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
            <div className="rd-panel" style={{ maxWidth: 400, width: '100%' }}>
              <h3>{t('admin.banUser')}: {banModal.user.nickname}</h3>
              <div style={{ marginTop: '1rem' }}>
                <label>{t('admin.banUntil')}</label>
                <input
                  type="datetime-local"
                  className="rd-input"
                  value={banUntil}
                  onChange={(e) => setBanUntil(e.target.value)}
                  style={{ width: '100%', marginBottom: '0.75rem' }}
                />
                <label>{t('admin.banReason')}</label>
                <input
                  type="text"
                  className="rd-input"
                  placeholder={t('admin.banReasonPlaceholder')}
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="button" className="rd-btn rd-btn-primary" disabled={!!busyId} onClick={handleBanSubmit}>
                  {busyId === banModal.user.id ? '…' : t('admin.ban')}
                </button>
                <button type="button" className="rd-btn" onClick={() => setBanModal(null)}>
                  {t('admin.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DesktopLayout>
  );
}
