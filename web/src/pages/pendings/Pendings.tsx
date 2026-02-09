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
  carId?: string | null;
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
      <div className="pendings-page rd-premium-panel">
        <div className="rd-premium-panel-header">
          <h1>{t('pendings.title')}</h1>
          <button type="button" className="rd-btn rd-btn-secondary" onClick={() => load()} disabled={loading}>
            {t('common.refresh')}
          </button>
        </div>
        <p className="rd-text-muted pendings-subtitle">{t('pendings.subtitle')}</p>
        {error && (
          <div className="pendings-error-wrap">
            <p className="rd-text-critical pendings-error">{error}</p>
            <button type="button" className="rd-btn rd-btn-primary" onClick={() => load()}>
              {t('auth.retry')}
            </button>
          </div>
        )}
        {loading && <p className="rd-text-muted">{t('common.loading')}</p>}
        {!loading && !error && list.length === 0 && (
          <p className="rd-text-muted">{t('pendings.noPending')}</p>
        )}
        {!loading && !error && list.length > 0 && (
          <div className="pendings-grid">
            {list.map((d) => (
              <div key={d.id} className="pendings-card rd-panel">
                <div className="pendings-card-header">
                  <div className="pendings-card-title">
                    <h3>{d.nickname}</h3>
                    <span className="pendings-card-date">{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}</span>
                  </div>
                </div>

                <div className="pendings-card-body">
                  <div className="pendings-info-grid">
                    <div className="pendings-info-item">
                      <span className="pendings-info-label">{t('auth.phone')}</span>
                      <span className="pendings-info-value">{d.phone ?? '—'}</span>
                    </div>

                    <div className="pendings-info-item">
                      <span className="pendings-info-label">{t('auth.email')}</span>
                      <span className="pendings-info-value pendings-email">
                        {d.email ? <a href={`mailto:${d.email}`}>{d.email}</a> : '—'}
                      </span>
                    </div>

                    <div className="pendings-info-item">
                      <span className="pendings-info-label">{t('drivers.driverId')}</span>
                      <span className="pendings-info-value pendings-driver-id">{d.driverId ?? '—'}</span>
                    </div>

                    <div className="pendings-info-item">
                      <span className="pendings-info-label">{t('drivers.carId')}</span>
                      <span className="pendings-info-value">{d.carId ?? '—'}</span>
                    </div>

                    <div className="pendings-info-item">
                      <span className="pendings-info-label">{t('auth.carType')}</span>
                      <span className="pendings-info-value">{d.carType ? t('auth.carType_' + d.carType) : '—'}</span>
                    </div>

                    <div className="pendings-info-item">
                      <span className="pendings-info-label">{t('auth.carPlateNumber')}</span>
                      <span className="pendings-info-value pendings-plate">{d.carPlateNumber ?? '—'}</span>
                    </div>

                    {d.carModelAndYear && (
                      <div className="pendings-info-item pendings-info-item-full">
                        <span className="pendings-info-label">{t('auth.carModelAndYear')}</span>
                        <span className="pendings-info-value">{d.carModelAndYear}</span>
                      </div>
                    )}

                    {d.carCapacity && (
                      <div className="pendings-info-item">
                        <span className="pendings-info-label">{t('auth.carCapacity')}</span>
                        <span className="pendings-info-value">{d.carCapacity} {t('auth.passengers')}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pendings-card-actions">
                  <button
                    type="button"
                    className="rd-btn pendings-btn-reject"
                    disabled={approvingId === d.id || rejectingId === d.id}
                    onClick={() => openRejectConfirm(d)}
                  >
                    {rejectingId === d.id ? '⏳ ' + t('pendings.rejecting') : '✕ ' + t('pendings.reject')}
                  </button>
                  <button
                    type="button"
                    className="rd-btn pendings-btn-approve"
                    disabled={approvingId === d.id || rejectingId === d.id}
                    onClick={() => handleApprove(d.id)}
                  >
                    {approvingId === d.id ? '⏳ ' + t('pendings.approving') : '✓ ' + t('pendings.approve')}
                  </button>
                </div>
              </div>
            ))}
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
