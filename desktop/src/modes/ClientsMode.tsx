import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
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

  const isAdmin = user?.role === 'ADMIN';

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

  return (
    <DesktopLayout>
      <div className="clients-mode">
        <div className="rd-panel">
          <div className="rd-panel-header">
            <h1>{t('clients.title')}</h1>
            <button type="button" className="rd-btn rd-btn-primary" onClick={() => setShowForm(!showForm)}>
              {t('clients.addClient')}
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
          {loading && <p className="logs-mode__muted">Loading…</p>}
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
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id}>
                      {isAdmin && <td>{c.phone ?? '—'}</td>}
                      <td>{c.name ?? '—'}</td>
                      <td>{c.userId ? <span className="rd-badge rd-badge-ok">{t('clients.driver')}</span> : '—'}</td>
                      <td>{formatPickup(c)}</td>
                      <td>{formatDropoff(c)}</td>
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
