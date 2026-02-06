import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DesktopLayout from '../layouts/DesktopLayout';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';

interface ClientRow {
  id: string;
  phone?: string;
  name: string | null;
  pickupAddr: string | null;
  dropoffAddr: string | null;
  pickupType: string | null;
  dropoffType: string | null;
  userId?: string | null;
  createdAt: string;
}

const PLACE_TYPES: Record<string, string> = {
  synagogue: 'clients.placeSynagogue',
  school: 'clients.placeSchool',
  hospital: 'clients.placeHospital',
  store: 'clients.placeStore',
  office: 'clients.placeOffice',
  home: 'clients.placeHome',
  other: 'clients.placeOther',
};

export default function ClientsMode() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formPhone, setFormPhone] = useState('');
  const [formName, setFormName] = useState('');
  const [formPickup, setFormPickup] = useState('');
  const [formDropoff, setFormDropoff] = useState('');
  const [formPickupType, setFormPickupType] = useState('');
  const [formDropoffType, setFormDropoffType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const canCreateOrder = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';

  function parseApiError(e: unknown): string {
    if (e instanceof Error) {
      try {
        const j = JSON.parse(e.message) as { message?: string };
        if (j?.message) return j.message;
      } catch {
        // not JSON
      }
      return e.message || 'Failed to load';
    }
    return 'Failed to load';
  }

  const loadClients = () => {
    setLoading(true);
    setError(null);
    api
      .get<ClientRow[]>('/passengers')
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadClients();
  }, []);

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    if (!formPhone.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/passengers', {
        phone: formPhone.trim(),
        name: formName.trim() || undefined,
        pickupAddr: formPickup.trim() || undefined,
        dropoffAddr: formDropoff.trim() || undefined,
        pickupType: formPickupType || undefined,
        dropoffType: formDropoffType || undefined,
      });
      setFormPhone('');
      setFormName('');
      setFormPickup('');
      setFormDropoff('');
      setFormPickupType('');
      setFormDropoffType('');
      setShowForm(false);
      loadClients();
    } catch {
      // keep form
    } finally {
      setSubmitting(false);
    }
  }

  function placeLabel(type: string | null): string {
    if (!type) return '';
    const key = PLACE_TYPES[type] ?? 'clients.placeOther';
    return t(key);
  }

  function formatPickup(p: ClientRow): string {
    const addr = p.pickupAddr ?? '—';
    if (p.pickupType && p.pickupType !== 'home') {
      return `${addr} (${placeLabel(p.pickupType)})`;
    }
    return addr;
  }

  function formatDropoff(p: ClientRow): string {
    const addr = p.dropoffAddr ?? '—';
    if (p.dropoffType && p.dropoffType !== 'home') {
      return `${addr} (${placeLabel(p.dropoffType)})`;
    }
    return addr;
  }

  async function handleEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    if (!editingClient) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/passengers/${id}`, {
        phone: editingClient.phone?.trim() || undefined,
        name: editingClient.name?.trim() || undefined,
        pickupAddr: editingClient.pickupAddr?.trim() || undefined,
        dropoffAddr: editingClient.dropoffAddr?.trim() || undefined,
        pickupType: editingClient.pickupType || undefined,
        dropoffType: editingClient.dropoffType || undefined,
      });
      setEditingClient(null);
      loadClients();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t('clients.deleteConfirm'))) return;
    setDeletingId(id);
    setError(null);
    try {
      await api.delete(`/passengers/${id}`);
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <DesktopLayout>
      <div className="clients-mode">
        <div className="rd-panel">
          <div className="rd-panel-header">
            <h1>{t('clients.title')}</h1>
            <button type="button" className="rd-btn rd-btn-primary" onClick={() => setShowForm(!showForm)}>
              {t('clients.addClient')}
            </button>
            <button type="button" className="rd-btn rd-btn-secondary" onClick={loadClients} disabled={loading}>
              {t('common.refresh')}
            </button>
          </div>
          {showForm && (
            <form onSubmit={handleAddClient} className="rd-panel" style={{ marginBottom: '1rem', padding: '1rem' }}>
              <label>{t('clients.phone')} *</label>
              <input type="text" className="rd-input" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} required />
              <label>{t('clients.name')}</label>
              <input type="text" className="rd-input" value={formName} onChange={(e) => setFormName(e.target.value)} />
              <label>{t('clients.pickup')}</label>
              <input type="text" className="rd-input" value={formPickup} onChange={(e) => setFormPickup(e.target.value)} placeholder={t('clients.pickup')} />
              <select className="rd-input" value={formPickupType} onChange={(e) => setFormPickupType(e.target.value)}>
                <option value="">—</option>
                <option value="home">{t('clients.placeHome')}</option>
                <option value="synagogue">{t('clients.placeSynagogue')}</option>
                <option value="school">{t('clients.placeSchool')}</option>
                <option value="hospital">{t('clients.placeHospital')}</option>
                <option value="store">{t('clients.placeStore')}</option>
                <option value="office">{t('clients.placeOffice')}</option>
                <option value="other">{t('clients.placeOther')}</option>
              </select>
              <label>{t('clients.dropoff')}</label>
              <input type="text" className="rd-input" value={formDropoff} onChange={(e) => setFormDropoff(e.target.value)} placeholder={t('clients.dropoff')} />
              <select className="rd-input" value={formDropoffType} onChange={(e) => setFormDropoffType(e.target.value)}>
                <option value="">—</option>
                <option value="home">{t('clients.placeHome')}</option>
                <option value="synagogue">{t('clients.placeSynagogue')}</option>
                <option value="school">{t('clients.placeSchool')}</option>
                <option value="hospital">{t('clients.placeHospital')}</option>
                <option value="store">{t('clients.placeStore')}</option>
                <option value="office">{t('clients.placeOffice')}</option>
                <option value="other">{t('clients.placeOther')}</option>
              </select>
              <button type="submit" className="rd-btn rd-btn-primary" disabled={submitting}>{submitting ? '…' : t('clients.add')}</button>
            </form>
          )}
          <p className="rd-text-muted" style={{ marginBottom: '1rem' }}>
            {isAdmin ? t('clients.subtitleAdmin') : t('clients.subtitleDispatcher')}
          </p>
          {error && <p className="rd-text-critical" style={{ marginBottom: '1rem' }}>{error}</p>}
          {loading && <p className="logs-mode__muted">{t('common.loading')}</p>}
          {!loading && clients.length === 0 && <p className="logs-mode__muted">{t('clients.noClients')}</p>}
          {!loading && clients.length > 0 && (
            <div className="logs-mode__table-wrap">
              <table className="logs-mode__table">
                <thead>
                  <tr>
                    {isAdmin && <th>{t('clients.phone')}</th>}
                    <th>{t('clients.name')}</th>
                    <th>{t('clients.type')}</th>
                    <th>{t('clients.pickup')}</th>
                    <th>{t('clients.dropoff')}</th>
                    {canCreateOrder && <th style={{ width: 100 }}>{t('modes.newOrder')}</th>}
                    <th style={{ width: 140 }}>{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id}>
                      {editingClient?.id === c.id ? (
                        <>
                          <td colSpan={isAdmin ? (canCreateOrder ? 8 : 7) : (canCreateOrder ? 7 : 6)}>
                            <form onSubmit={(e) => handleEdit(e, c.id)} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
                              <label style={{ width: '100%' }}>{t('clients.editClient')}</label>
                              {isAdmin && (
                                <input type="text" className="rd-input" placeholder={t('clients.phone')} value={editingClient.phone ?? ''} onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })} />
                              )}
                              <input type="text" className="rd-input" placeholder={t('clients.name')} value={editingClient.name ?? ''} onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })} />
                              <input type="text" className="rd-input" placeholder={t('clients.pickup')} value={editingClient.pickupAddr ?? ''} onChange={(e) => setEditingClient({ ...editingClient, pickupAddr: e.target.value })} />
                              <select className="rd-input" value={editingClient.pickupType ?? ''} onChange={(e) => setEditingClient({ ...editingClient, pickupType: e.target.value })}>
                                <option value="">—</option>
                                <option value="home">{t('clients.placeHome')}</option>
                                <option value="synagogue">{t('clients.placeSynagogue')}</option>
                                <option value="school">{t('clients.placeSchool')}</option>
                                <option value="hospital">{t('clients.placeHospital')}</option>
                                <option value="store">{t('clients.placeStore')}</option>
                                <option value="office">{t('clients.placeOffice')}</option>
                                <option value="other">{t('clients.placeOther')}</option>
                              </select>
                              <input type="text" className="rd-input" placeholder={t('clients.dropoff')} value={editingClient.dropoffAddr ?? ''} onChange={(e) => setEditingClient({ ...editingClient, dropoffAddr: e.target.value })} />
                              <select className="rd-input" value={editingClient.dropoffType ?? ''} onChange={(e) => setEditingClient({ ...editingClient, dropoffType: e.target.value })}>
                                <option value="">—</option>
                                <option value="home">{t('clients.placeHome')}</option>
                                <option value="synagogue">{t('clients.placeSynagogue')}</option>
                                <option value="school">{t('clients.placeSchool')}</option>
                                <option value="hospital">{t('clients.placeHospital')}</option>
                                <option value="store">{t('clients.placeStore')}</option>
                                <option value="office">{t('clients.placeOffice')}</option>
                                <option value="other">{t('clients.placeOther')}</option>
                              </select>
                              <button type="submit" className="rd-btn rd-btn-primary" disabled={submitting}>{submitting ? '…' : t('clients.save')}</button>
                              <button type="button" className="rd-btn" onClick={() => setEditingClient(null)}>{t('admin.cancel')}</button>
                            </form>
                          </td>
                        </>
                      ) : (
                        <>
                          {isAdmin && <td>{c.phone ?? '—'}</td>}
                          <td>{c.name ?? '—'}</td>
                          <td>{c.userId ? <span className="rd-badge rd-badge-ok">{t('clients.driver')}</span> : '—'}</td>
                          <td>{formatPickup(c)}</td>
                          <td>{formatDropoff(c)}</td>
                          {canCreateOrder && (
                            <td>
                              <button type="button" className="rd-btn rd-btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }} onClick={() => navigate('/control', { state: { passengerPrefill: { phone: c.phone, name: c.name ?? undefined, pickupAddr: c.pickupAddr ?? undefined, dropoffAddr: c.dropoffAddr ?? undefined, pickupType: c.pickupType ?? undefined, dropoffType: c.dropoffType ?? undefined } } })}>
                                + {t('modes.newOrder')}
                              </button>
                            </td>
                          )}
                          <td>
                            <button type="button" className="rd-btn" style={{ marginRight: '0.25rem' }} onClick={() => setEditingClient({ ...c })}>{t('clients.edit')}</button>
                            <button type="button" className="rd-btn" disabled={deletingId === c.id} onClick={() => handleDelete(c.id)}>{deletingId === c.id ? '…' : t('clients.delete')}</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DesktopLayout>
  );
}
