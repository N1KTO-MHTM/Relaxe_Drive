import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth';
import { api } from '../../api/client';
import './Addresses.css';

interface SavedAddress {
  id: string;
  address: string;
  phone?: string | null;
  category?: string | null;
  type?: string | null;
  useCount?: number;
  lastUsedAt?: string;
}

export default function Addresses() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const canEdit = role === 'ADMIN' || role === 'DISPATCHER';

  const [list, setList] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formType, setFormType] = useState<string>('both');
  const [formCategory, setFormCategory] = useState<string>('other');
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!canEdit) return;
    setLoading(true);
    setError('');
    api
      .get<SavedAddress[]>('/addresses')
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [canEdit]);

  function openEdit(item: SavedAddress) {
    setEditingId(item.id);
    setFormAddress(item.address);
    setFormPhone(item.phone ?? '');
    setFormType(item.type ?? 'both');
    setFormCategory(item.category ?? 'other');
  }

  function cancelEdit() {
    setEditingId(null);
    setFormAddress('');
    setFormPhone('');
    setFormType('both');
    setFormCategory('other');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError('');
    const body = {
      address: formAddress.trim(),
      phone: formPhone.trim() || undefined,
      type: formType,
      category: formCategory,
    };
    const promise = editingId
      ? api.patch<SavedAddress>(`/addresses/${editingId}`, body)
      : api.post<SavedAddress>('/addresses', body);
    promise
      .then((saved) => {
        if (editingId) {
          setList((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...saved } : a)));
        } else {
          setList((prev) => [saved as SavedAddress, ...prev]);
        }
        cancelEdit();
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to save'))
      .finally(() => setSaving(false));
  }

  function handleDelete(id: string) {
    if (!canEdit) return;
    setSaving(true);
    setError('');
    api
      .delete(`/addresses/${id}`)
      .then(() => {
        setList((prev) => prev.filter((a) => a.id !== id));
        setDeleteConfirmId(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to delete'))
      .finally(() => setSaving(false));
  }

  if (!canEdit) {
    return (
      <div className="rd-page addresses-page">
        <p className="rd-text-muted">{t('auth.staffOnly')}</p>
      </div>
    );
  }

  return (
    <div className="rd-page addresses-page">
      <div className="addresses-page__grid">
        <div className="addresses-page__half addresses-page__list-panel">
          <h1>{t('addresses.title')}</h1>
          <p className="rd-text-muted">{t('addresses.subtitle')}</p>
          {error && <p className="rd-text-critical" style={{ marginBottom: '0.75rem' }}>{error}</p>}

          <form onSubmit={handleSubmit} className="addresses-form">
            <input
              type="text"
              className="rd-input"
              placeholder={t('addresses.address')}
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              required
            />
            <input
              type="text"
              className="rd-input"
              placeholder={t('addresses.phone')}
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
            />
            <select className="rd-input" value={formType} onChange={(e) => setFormType(e.target.value)}>
              <option value="pickup">{t('addresses.typePickup')}</option>
              <option value="dropoff">{t('addresses.typeDropoff')}</option>
              <option value="both">{t('addresses.typeBoth')}</option>
            </select>
            <select className="rd-input" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
              <option value="home">{t('addresses.categoryHome')}</option>
              <option value="work">{t('addresses.categoryWork')}</option>
              <option value="frequent">{t('addresses.categoryFrequent')}</option>
              <option value="other">{t('addresses.categoryOther')}</option>
            </select>
            <div className="addresses-form__actions">
              <button type="submit" className="rd-btn rd-btn-primary" disabled={saving || !formAddress.trim()}>
                {editingId ? t('common.save') : t('addresses.addNew')}
              </button>
              {editingId && (
                <button type="button" className="rd-btn" onClick={cancelEdit}>
                  {t('common.cancel')}
                </button>
              )}
            </div>
          </form>

          {loading ? (
            <p className="rd-text-muted">{t('common.loading')}</p>
          ) : list.length === 0 ? (
            <p className="rd-text-muted">{t('addresses.noAddresses')}</p>
          ) : (
            <ul className="addresses-list">
              {list.map((item) => (
                <li key={item.id} className="addresses-list__item rd-panel">
                  <div className="addresses-list__main">
                    <span className="addresses-list__address">{item.address}</span>
                    {item.phone && <span className="addresses-list__phone">{item.phone}</span>}
                    <span className="addresses-list__meta">
                      {item.type ?? 'both'} · {item.category ?? 'other'}
                      {item.useCount != null && item.useCount > 0 && ` · ${t('addresses.useCount', { count: item.useCount })}`}
                    </span>
                  </div>
                  <div className="addresses-list__actions">
                    <button type="button" className="rd-btn rd-btn--small" onClick={() => openEdit(item)}>
                      {t('common.edit')}
                    </button>
                    {deleteConfirmId === item.id ? (
                      <>
                        <button type="button" className="rd-btn rd-btn-danger rd-btn--small" onClick={() => handleDelete(item.id)}>
                          {t('common.confirm')}
                        </button>
                        <button type="button" className="rd-btn rd-btn--small" onClick={() => setDeleteConfirmId(null)}>
                          {t('common.cancel')}
                        </button>
                      </>
                    ) : (
                      <button type="button" className="rd-btn rd-btn--small" onClick={() => setDeleteConfirmId(item.id)}>
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="addresses-page__half addresses-page__detail-panel">
          <div className="addresses-detail-placeholder">
            <p className="rd-text-muted">{t('addresses.subtitle')}</p>
            <p className="rd-text-muted" style={{ marginTop: '0.5rem' }}>
              {list.length} {t('addresses.title').toLowerCase()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
