import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useToastStore } from '../../store/toast';
import { downloadCsv } from '../../utils/exportCsv';
import Pagination, { paginate, DEFAULT_PAGE_SIZE } from '../../components/Pagination';
import { PassengersMap } from './PassengersMap';
import type { PassengerRow } from '../../types';
import './Passengers.css';

const PLACE_KEYS: Record<string, string> = {
  home: 'passengers.placeHome',
  synagogue: 'passengers.placeSynagogue',
  school: 'passengers.placeSchool',
  hospital: 'passengers.placeHospital',
  store: 'passengers.placeStore',
  office: 'passengers.placeOffice',
  other: 'passengers.placeOther',
};

function parseApiError(e: unknown): string {
  if (e instanceof Error) {
    try {
      const j = JSON.parse(e.message) as { message?: string; statusCode?: number };
      if (j?.message) return j.message;
    } catch {
      // not JSON
    }
    return e.message || 'Failed to load';
  }
  return 'Failed to load';
}

/** Extract postal code from address (last 5 digits or last word if it looks like a postal code) */
function extractPostalCode(address: string | null | undefined): string {
  if (!address) return '—';
  // Try to find 5-digit postal code
  const match = address.match(/\b\d{5}\b/);
  if (match) return match[0];
  // Try to find last word that looks like a postal code (alphanumeric)
  const words = address.trim().split(/\s+/);
  const lastWord = words[words.length - 1];
  if (lastWord && /^[A-Z0-9]{3,}$/i.test(lastWord)) return lastWord;
  return '—';
}

export default function Passengers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToastStore();
  const [list, setList] = useState<PassengerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formPhone, setFormPhone] = useState('');
  const [formName, setFormName] = useState('');
  const [formPickup, setFormPickup] = useState('');
  const [formPickupType, setFormPickupType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingClient, setEditingClient] = useState<PassengerRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const filteredList = searchQuery.trim()
    ? list.filter(
      (p) =>
        (p.phone ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.id ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    : list;

  const paginatedList = useMemo(
    () => paginate(filteredList, page, DEFAULT_PAGE_SIZE),
    [filteredList, page],
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  function loadPassengers() {
    setLoading(true);
    setError(null);
    api
      .get<PassengerRow[]>('/clients')
      .then((data) => {
        setList(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        setError(parseApiError(e));
        setList([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPassengers();
  }, [showForm]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!formPhone.trim()) return;
    const phone = formPhone.trim();
    const pickup = formPickup.trim();
    if (pickup) {
      const already = list.some(
        (p) => (p.phone ?? '').trim() === phone && (p.pickupAddr ?? '').trim() === pickup,
      );
      if (already) {
        toast.error(t('passengers.duplicatePhonePickup'));
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/clients', {
        phone: formPhone.trim(),
        name: formName.trim() || undefined,
        pickupAddr: formPickup.trim() || undefined,
        pickupType: formPickupType || undefined,
      });
      setFormPhone('');
      setFormName('');
      setFormPickup('');
      setFormPickupType('');
      setShowForm(false);
      toast.success(t('toast.clientAdded'));
      loadPassengers();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSubmitting(false);
    }
  }

  function placeLabel(type: string | null): string {
    if (!type) return '';
    return t(PLACE_KEYS[type] ?? 'passengers.placeOther');
  }

  async function handleEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    if (!editingClient) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/clients/${id}`, {
        phone: editingClient.phone?.trim() || undefined,
        name: editingClient.name?.trim() || undefined,
        pickupAddr: editingClient.pickupAddr?.trim() || undefined,
        pickupType: editingClient.pickupType || undefined,
      });
      setEditingClient(null);
      toast.success(t('passengers.saved'));
      const data = await api.get<PassengerRow[]>('/clients');
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t('passengers.deleteConfirm'))) return;
    setDeletingId(id);
    setError(null);
    try {
      await api.delete(`/clients/${id}`);
      toast.success(t('passengers.deleted'));
      setList((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rd-page">
      <div className="passengers-page rd-premium-panel">
        <div className="rd-panel-header">
          <h1>{t('passengers.title')}</h1>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              className="rd-input passengers-search-input"
              placeholder={t('passengers.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t('passengers.search')}
            />
            <button type="button" className="rd-btn" onClick={() => downloadCsv(filteredList, 'clients.csv', [
              { key: 'id', label: t('passengers.id') },
              { key: 'phone', label: t('passengers.phone') },
              { key: 'name', label: t('passengers.name') },
              { key: 'pickupAddr', label: t('passengers.pickup') },
            ])}>
              {t('passengers.exportCsv')}
            </button>
            <button type="button" className="rd-btn rd-btn-primary" onClick={() => setShowForm(!showForm)}>
              {t('passengers.addClient')}
            </button>
            <button type="button" className="rd-btn rd-btn-secondary" onClick={loadPassengers} disabled={loading}>
              {t('common.refresh')}
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="passengers-form">
            <label>{t('passengers.phone')} *</label>
            <input type="text" className="rd-input" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} required />
            <label>{t('passengers.name')}</label>
            <input type="text" className="rd-input" value={formName} onChange={(e) => setFormName(e.target.value)} />
            <label>{t('passengers.pickup')}</label>
            <div className="passengers-form-row">
              <input type="text" className="rd-input" value={formPickup} onChange={(e) => setFormPickup(e.target.value)} placeholder={t('passengers.pickup')} />
              <select className="rd-input passengers-form-select" value={formPickupType} onChange={(e) => setFormPickupType(e.target.value)}>
                <option value="">—</option>
                <option value="home">{t('passengers.placeHome')}</option>
                <option value="synagogue">{t('passengers.placeSynagogue')}</option>
                <option value="school">{t('passengers.placeSchool')}</option>
                <option value="hospital">{t('passengers.placeHospital')}</option>
                <option value="store">{t('passengers.placeStore')}</option>
                <option value="office">{t('passengers.placeOffice')}</option>
                <option value="other">{t('passengers.placeOther')}</option>
              </select>
            </div>
            <button type="submit" className="rd-btn rd-btn-primary" disabled={submitting}>
              {submitting ? '…' : t('passengers.add')}
            </button>
          </form>
        )}

        <p className="rd-text-muted passengers-subtitle">{t('passengers.subtitle')}</p>

        {error && <p className="rd-text-critical passengers-error">{error}</p>}
        {loading && <p className="rd-text-muted">{t('common.loading')}</p>}
        {!loading && !error && list.length === 0 && <p className="rd-text-muted">{t('passengers.noClients')}</p>}
        {!loading && !error && list.length > 0 && filteredList.length === 0 && <p className="rd-text-muted">{t('passengers.noMatch')}</p>}
        {!loading && !error && list.length > 0 && (
          <section className="passengers-map-section" aria-label={t('passengers.clientsOnMap')}>
            <h2 className="passengers-map-heading">{t('passengers.clientsOnMap')}</h2>
            <PassengersMap clients={filteredList} className="passengers-map" />
          </section>
        )}
        {!loading && !error && filteredList.length > 0 && (
          <>
            <div className="rd-table-wrapper">
              <table className="rd-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>{t('passengers.id')}</th>
                    <th>{t('passengers.phone')}</th>
                    <th>{t('passengers.name')}</th>
                    <th>{t('passengers.type')}</th>
                    <th>{t('passengers.pickup')}</th>
                    <th style={{ width: 100 }}>{t('nav.newOrder')}</th>
                    <th style={{ width: 120 }}>{t('roles.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedList.map((p) => (
                    <tr key={p.id}>
                      {editingClient?.id === p.id ? (
                        <>
                          <td colSpan={7}>
                            <form onSubmit={(e) => handleEdit(e, p.id)} className="passengers-form" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
                              <label style={{ width: '100%' }}>{t('passengers.editClient')}</label>
                              <input type="text" className="rd-input" placeholder={t('passengers.phone')} value={editingClient.phone ?? ''} onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })} />
                              <input type="text" className="rd-input" placeholder={t('passengers.name')} value={editingClient.name ?? ''} onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })} />
                              <input type="text" className="rd-input" placeholder={t('passengers.pickup')} value={editingClient.pickupAddr ?? ''} onChange={(e) => setEditingClient({ ...editingClient, pickupAddr: e.target.value })} />
                              <select className="rd-input" value={editingClient.pickupType ?? ''} onChange={(e) => setEditingClient({ ...editingClient, pickupType: e.target.value })}>
                                <option value="">—</option>
                                <option value="home">{t('passengers.placeHome')}</option>
                                <option value="synagogue">{t('passengers.placeSynagogue')}</option>
                                <option value="school">{t('passengers.placeSchool')}</option>
                                <option value="hospital">{t('passengers.placeHospital')}</option>
                                <option value="store">{t('passengers.placeStore')}</option>
                                <option value="office">{t('passengers.placeOffice')}</option>
                                <option value="other">{t('passengers.placeOther')}</option>
                              </select>
                              <button type="submit" className="rd-btn rd-btn-primary" disabled={submitting}>{submitting ? '…' : t('passengers.save')}</button>
                              <button type="button" className="rd-btn" onClick={() => setEditingClient(null)}>{t('dashboard.cancel')}</button>
                            </form>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="passengers-cell-id rd-id-compact" title={p.pickupAddr ?? p.id}>{extractPostalCode(p.pickupAddr)}</td>
                          <td>{p.phone ?? '—'}</td>
                          <td>{p.name ?? '—'}</td>
                          <td>{p.userId ? <span className="rd-badge rd-badge-ok">{t('passengers.driver')}</span> : '—'}</td>
                          <td>
                            {p.pickupAddr ?? '—'}
                            {p.pickupType && p.pickupType !== 'home' && (
                              <span className="rd-text-muted"> ({placeLabel(p.pickupType)})</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="rd-btn rd-btn-primary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                              onClick={() => navigate('/dashboard', {
                                state: {
                                  openForm: true,
                                  passengerPrefill: {
                                    phone: p.phone ?? '',
                                    name: p.name ?? '',
                                    pickupAddr: p.pickupAddr ?? '',
                                    pickupType: p.pickupType ?? '',
                                  },
                                },
                              })}
                            >
                              + {t('nav.newOrder')}
                            </button>
                          </td>
                          <td>
                            <button type="button" className="rd-btn" style={{ marginRight: '0.25rem' }} onClick={() => setEditingClient({ ...p })}>{t('passengers.edit')}</button>
                            <button type="button" className="rd-btn" disabled={deletingId === p.id} onClick={() => handleDelete(p.id)}>{deletingId === p.id ? '…' : t('passengers.delete')}</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} totalItems={filteredList.length} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
