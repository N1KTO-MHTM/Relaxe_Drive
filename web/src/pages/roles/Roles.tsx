import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import type { Role } from '../../store/auth';
import { PassengersMap } from '../passengers/PassengersMap';
import type { PassengerRow } from '../../types';
import { shortId } from '../../utils/shortId';
import '../passengers/Passengers.css';
import './Roles.css';

/** Special filter value: show Clients on map (passengers) instead of user table */
const PASSENGER_VIEW = '__PASSENGER__';

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
  const [passengersList, setPassengersList] = useState<PassengerRow[]>([]);
  const [passengersLoading, setPassengersLoading] = useState(false);

  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'ADMIN';
  const isPassengerView = filterRole === PASSENGER_VIEW;

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

  useEffect(() => {
    if (!isPassengerView) return;
    setPassengersLoading(true);
    api.get<PassengerRow[]>('/passengers')
      .then((data) => setPassengersList(Array.isArray(data) ? data : []))
      .catch(() => setPassengersList([]))
      .finally(() => setPassengersLoading(false));
  }, [isPassengerView]);

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
        navigator.clipboard.writeText(res.link).catch(() => {});
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
      <div className="rd-panel roles-panel">
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
              <option value={PASSENGER_VIEW}>{t('roles.passengerView')}</option>
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
        {isPassengerView ? (
          <>
            <section className="passengers-map-section roles-passengers-map-section" aria-label={t('passengers.clientsOnMap')}>
              <h2 className="passengers-map-heading">{t('passengers.clientsOnMap')}</h2>
              {passengersLoading ? (
                <p className="rd-text-muted">{t('common.loading')}</p>
              ) : (
                <PassengersMap clients={passengersList} className="passengers-map" />
              )}
            </section>
            <p className="rd-text-muted" style={{ marginTop: '0.75rem' }}>
              <button type="button" className="rd-btn rd-btn-primary" onClick={() => navigate('/passengers')}>
                {t('passengers.title')} — {t('passengers.addClient')}
              </button>
            </p>
          </>
        ) : loading ? (
          <p className="rd-text-muted">{t('common.loading')}</p>
        ) : filteredUsers.length === 0 ? (
          <p className="rd-text-muted">{users.length === 0 ? t('roles.noUsers') : t('roles.noUsers')}</p>
        ) : (
          <div className="rd-table-wrapper">
            <table className="rd-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>{t('auth.nickname')}</th>
                  <th>{t('roles.email')}</th>
                  <th>{t('roles.phone')}</th>
                  <th>{t('roles.role')}</th>
                  <th>{t('roles.userId')}</th>
                  <th>{t('roles.driverId')}</th>
                  <th>{t('roles.carId')}</th>
                  <th>{t('roles.carType')}</th>
                  <th>{t('roles.carPlateNumber')}</th>
                  {isAdmin && <th>{t('roles.status')}</th>}
                  <th>{t('roles.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nickname}</td>
                    <td className="roles-cell-email" title={u.email ?? undefined}>{u.email ? <a href={`mailto:${u.email}`}>{u.email}</a> : '—'}</td>
                    <td className="roles-cell-phone">{u.phone ?? '—'}</td>
                    <td>
                      <select
                        className="rd-input roles-select-role"
                        value={u.role}
                        disabled={updatingId === u.id || (isAdmin && u.id === currentUser?.id)}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                        title={t('roles.role') + ': ' + t('roles.' + u.role.toLowerCase())}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{t('roles.' + r.toLowerCase())}</option>
                        ))}
                      </select>
                    </td>
                    <td className="roles-cell-id rd-id-compact" title={u.id}>{shortId(u.id)}</td>
                    <td>{u.role === 'DRIVER' ? (u.driverId ?? '—') : '—'}</td>
                    <td>{u.role === 'DRIVER' ? (u.carId ?? '—') : '—'}</td>
                    <td>{u.role === 'DRIVER' ? (u.carType ? t('auth.carType_' + u.carType) : '—') : '—'}</td>
                    <td>{u.carPlateNumber ?? '—'}</td>
                    {isAdmin && (
                      <td>
                        {u.blocked && <span className="rd-badge rd-badge-critical">{t('roles.blocked')}</span>}
                        {u.bannedUntil && new Date(u.bannedUntil) > new Date() && (
                          <span className="rd-badge rd-badge-critical" title={u.banReason ?? ''}>
                            {t('roles.bannedUntil')} {new Date(u.bannedUntil).toLocaleString()}
                          </span>
                        )}
                        {!u.blocked && (!u.bannedUntil || new Date(u.bannedUntil) <= new Date()) && (
                          <span className="rd-badge rd-badge-ok">{t('roles.active')}</span>
                        )}
                      </td>
                    )}
                    <td>
                      <div className="roles-actions-cell">
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
                        <div style={{ marginTop: 8, fontSize: '0.85rem', wordBreak: 'break-all' }}>
                          {t('roles.resetLinkCopied')}: <a href={generatedLinkFor.link} target="_blank" rel="noopener noreferrer">{generatedLinkFor.link}</a>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          <div className="rd-panel" style={{ maxWidth: 400, width: '100%' }}>
            <h3>{t('roles.delete')}: {deleteConfirmUser.nickname}</h3>
            <p className="rd-text-muted" style={{ marginTop: 8 }}>{t('roles.deleteConfirm')}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" className="rd-btn rd-btn-danger" disabled={!!busyId} onClick={() => handleDelete(deleteConfirmUser)}>
                {busyId === deleteConfirmUser.id ? '…' : t('roles.delete')}
              </button>
              <button type="button" className="rd-btn" onClick={() => setDeleteConfirmUser(null)}>{t('common.cancel')}</button>
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
              <button type="button" className="rd-btn" onClick={() => setBanModal(null)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
