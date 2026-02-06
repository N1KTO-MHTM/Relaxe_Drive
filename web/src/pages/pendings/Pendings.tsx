import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useToastStore } from '../../store/toast';
import './Pendings.css';

interface PendingDriver {
  id: string;
  nickname: string;
  email?: string | null;
  phone?: string | null;
  driverId?: string | null;
  carType?: string | null;
  carPlateNumber?: string | null;
  carCapacity?: number | null;
  carModelAndYear?: string | null;
  createdAt: string;
}

export default function Pendings() {
  const { t } = useTranslation();
  const toast = useToastStore();
  const [list, setList] = useState<PendingDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectConfirmUser, setRejectConfirmUser] = useState<PendingDriver | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<PendingDriver[]>('/users/pending')
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => {
        setError(t('pendings.loadError'));
        setList([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(userId: string) {
    setApprovingId(userId);
    setError(null);
    try {
      await api.patch(`/users/${userId}/approve`, {});
      setList((prev) => prev.filter((u) => u.id !== userId));
      toast.success(t('toast.driverApproved'));
    } catch {
      setError(t('toast.approveFailed'));
      toast.error(t('toast.approveFailed'));
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject(userId: string) {
    setRejectingId(userId);
    setRejectConfirmUser(null);
    setError(null);
    try {
      await api.patch(`/users/${userId}/reject`, {});
      setList((prev) => prev.filter((u) => u.id !== userId));
      toast.success(t('toast.driverRejected'));
    } catch {
      setError(t('toast.rejectDriverFailed'));
      toast.error(t('toast.rejectDriverFailed'));
    } finally {
      setRejectingId(null);
    }
  }

  function openRejectConfirm(d: PendingDriver) {
    setRejectConfirmUser(d);
  }

  return (
    <div className="rd-page">
      <div className="pendings-page rd-panel">
        <div className="rd-panel-header">
          <h1>{t('pendings.title')}</h1>
          <button type="button" className="rd-btn rd-btn-secondary" onClick={() => load()} disabled={loading}>
            {t('common.refresh')}
          </button>
        </div>
        <p className="rd-text-muted pendings-subtitle">{t('pendings.subtitle')}</p>
        {error && <p className="rd-text-critical pendings-error">{error}</p>}
        {loading && <p className="rd-text-muted">{t('common.loading')}</p>}
        {!loading && !error && list.length === 0 && (
          <p className="rd-text-muted">{t('pendings.noPending')}</p>
        )}
        {!loading && !error && list.length > 0 && (
          <div className="pendings-table-wrapper rd-table-wrapper">
            <table className="rd-table pendings-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>{t('auth.nickname')}</th>
                  <th>{t('auth.phone')}</th>
                  <th>{t('auth.email')}</th>
                  <th>{t('drivers.driverId')}</th>
                  <th>{t('auth.carType')}</th>
                  <th>{t('auth.carPlateNumber')}</th>
                  <th>{t('pendings.registered')}</th>
                  <th className="pendings-th-actions">{t('pendings.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.id} className="pendings-row">
                    <td className="pendings-cell-nickname"><strong>{d.nickname}</strong></td>
                    <td className="pendings-cell-phone">{d.phone ?? '—'}</td>
                    <td className="pendings-cell-email" title={d.email ?? undefined}>
                      {d.email ? <a href={`mailto:${d.email}`}>{d.email}</a> : '—'}
                    </td>
                    <td className="pendings-cell-driver-id">{d.driverId ?? '—'}</td>
                    <td>{d.carType ? t('auth.carType_' + d.carType) : '—'}</td>
                    <td className="pendings-cell-plate">{d.carPlateNumber ?? '—'}</td>
                    <td className="pendings-cell-date">{d.createdAt ? new Date(d.createdAt).toLocaleString() : '—'}</td>
                    <td className="pendings-cell-actions">
                      <div className="pendings-actions">
                        <button
                          type="button"
                          className="rd-btn rd-btn-primary pendings-btn-approve"
                          disabled={approvingId === d.id || rejectingId === d.id}
                          onClick={() => handleApprove(d.id)}
                          title={t('pendings.approve')}
                        >
                          {approvingId === d.id ? '…' : t('pendings.approve')}
                        </button>
                        <button
                          type="button"
                          className="rd-btn rd-btn-danger pendings-btn-reject"
                          disabled={approvingId === d.id || rejectingId === d.id}
                          onClick={() => openRejectConfirm(d)}
                          title={t('pendings.reject')}
                        >
                          {rejectingId === d.id ? '…' : t('pendings.reject')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rejectConfirmUser && (
          <div
            className="pendings-reject-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pendings-reject-title"
          >
            <div className="pendings-reject-modal-backdrop" onClick={() => setRejectConfirmUser(null)} />
            <div className="pendings-reject-modal-content rd-panel">
              <h3 id="pendings-reject-title">{t('pendings.reject')}: {rejectConfirmUser.nickname}</h3>
              <p className="rd-text-muted">{t('pendings.rejectConfirm')}</p>
              <div className="pendings-reject-modal-actions">
                <button
                  type="button"
                  className="rd-btn rd-btn-danger"
                  disabled={!!rejectingId}
                  onClick={() => handleReject(rejectConfirmUser.id)}
                >
                  {rejectingId === rejectConfirmUser.id ? '…' : t('pendings.reject')}
                </button>
                <button type="button" className="rd-btn rd-btn-secondary" onClick={() => setRejectConfirmUser(null)} disabled={!!rejectingId}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
