import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useToastStore } from '../../store/toast';
import { downloadCsv } from '../../utils/exportCsv';
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

  const filteredList = searchQuery.trim()
    ? list.filter(
        (p) =>
          (p.phone ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : list;

  useEffect(() => {
    let cancelled = false;
    api
      .get<PassengerRow[]>('/passengers')
      .then((data) => {
        if (!cancelled) setList(Array.isArray(data) ? data : []);
        if (!cancelled) setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(parseApiError(e));
        if (!cancelled) setList([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [showForm]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!formPhone.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/passengers', {
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
      const data = await api.get<PassengerRow[]>('/passengers');
      setList(Array.isArray(data) ? data : []);
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

  return (
    <div className="rd-page">
      <div className="passengers-page rd-panel">
      <div className="rd-panel-header">
        <h1>{t('passengers.title')}</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            className="rd-input"
            placeholder={t('passengers.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 200 }}
          />
          <button type="button" className="rd-btn" onClick={() => downloadCsv(filteredList, 'clients.csv', [
            { key: 'phone', label: t('passengers.phone') },
            { key: 'name', label: t('passengers.name') },
            { key: 'pickupAddr', label: t('passengers.pickup') },
          ])}>
            {t('passengers.exportCsv')}
          </button>
          <button type="button" className="rd-btn rd-btn-primary" onClick={() => setShowForm(!showForm)}>
            {t('passengers.addClient')}
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
      {loading && <p className="rd-text-muted">Loading…</p>}
      {!loading && !error && list.length === 0 && <p className="rd-text-muted">{t('passengers.noClients')}</p>}
      {!loading && !error && list.length > 0 && filteredList.length === 0 && <p className="rd-text-muted">{t('passengers.noMatch')}</p>}
      {!loading && !error && filteredList.length > 0 && (
        <div className="rd-table-wrapper">
          <table className="rd-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>{t('passengers.phone')}</th>
                <th>{t('passengers.name')}</th>
                <th>{t('passengers.type')}</th>
                <th>{t('passengers.pickup')}</th>
                <th style={{ width: 100 }}>{t('nav.newOrder')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((p) => (
                <tr key={p.id}>
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
