import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
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
  const [list, setList] = useState<PendingDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

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
          <div className="rd-table-wrapper">
            <table className="rd-table" style={{ width: '100%' }}>
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
                        disabled={approvingId === d.id}
                        onClick={() => handleApprove(d.id)}
                      >
                        {approvingId === d.id ? '…' : t('pendings.approve')}
                      </button>
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
