import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DesktopLayout from '../layouts/DesktopLayout';
import { api } from '../api/client';

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

export default function PendingsMode() {
  const { t } = useTranslation();
  const [list, setList] = useState<PendingDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<PendingDriver[]>('/users/pending')
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setError('Failed to load pending drivers'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(userId: string) {
    setApprovingId(userId);
    try {
      await api.patch(`/users/${userId}/approve`, {});
      setList((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      setError('Failed to approve driver');
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject(userId: string) {
    if (!window.confirm(t('pendings.rejectConfirm'))) return;
    setRejectingId(userId);
    try {
      await api.patch(`/users/${userId}/reject`, {});
      setList((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      setError('Failed to reject driver');
    } finally {
      setRejectingId(null);
    }
  }

  return (
    <DesktopLayout>
      <div className="pendings-mode">
        <div className="rd-panel-header">
          <h1>{t('pendings.title')}</h1>
          <button type="button" className="rd-btn rd-btn-secondary" onClick={load} disabled={loading}>
            {t('common.refresh')}
          </button>
        </div>
        <p className="rd-text-muted" style={{ marginBottom: '1rem' }}>{t('pendings.subtitle')}</p>
        {error && <p className="rd-text-critical" style={{ marginBottom: '1rem' }}>{error}</p>}
        {loading && <p className="logs-mode__muted">{t('common.loading')}</p>}
        {!loading && !error && list.length === 0 && <p className="logs-mode__muted">{t('pendings.noPending')}</p>}
        {!loading && !error && list.length > 0 && (
          <div className="logs-mode__table-wrap">
            <table className="logs-mode__table">
              <thead>
                <tr>
                  <th>{t('auth.nickname')}</th>
                  <th>{t('auth.phone')}</th>
                  <th>{t('auth.email')}</th>
                  <th>{t('drivers.driverId')}</th>
                  <th>{t('auth.carType')}</th>
                  <th>{t('auth.carPlateNumber')}</th>
                  <th>{t('pendings.registered')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.nickname}</strong></td>
                    <td>{d.phone ?? '—'}</td>
                    <td>{d.email ?? '—'}</td>
                    <td>{d.driverId ?? '—'}</td>
                    <td>{d.carType ? t('auth.carType_' + d.carType) : '—'}</td>
                    <td>{d.carPlateNumber ?? '—'}</td>
                    <td>{d.createdAt ? new Date(d.createdAt).toLocaleString() : '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="rd-btn rd-btn-primary"
                        disabled={approvingId === d.id || rejectingId === d.id}
                        onClick={() => handleApprove(d.id)}
                      >
                        {approvingId === d.id ? '…' : t('pendings.approve')}
                      </button>
                      <button
                        type="button"
                        className="rd-btn rd-btn-danger"
                        style={{ marginLeft: '0.25rem' }}
                        disabled={approvingId === d.id || rejectingId === d.id}
                        onClick={() => handleReject(d.id)}
                      >
                        {rejectingId === d.id ? '…' : t('pendings.reject')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DesktopLayout>
  );
}
