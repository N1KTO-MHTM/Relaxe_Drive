import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth';
import { api } from '../../api/client';
import './PhoneBase.css';

interface PhoneBaseEntry {
  id: string;
  originalPhone: string;
  targetPhone: string;
  description?: string | null;
}

export default function PhoneBase() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';

  const [list, setList] = useState<PhoneBaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [duplicateError, setDuplicateError] = useState('');
  const [originalPhone, setOriginalPhone] = useState('');
  const [targetPhone, setTargetPhone] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!canEdit) return;
    setLoading(true);
    setError('');
    api
      .get<PhoneBaseEntry[]>('/phone-base')
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [canEdit]);

  function normalizePhone(s: string): string {
    return s.replace(/\D/g, '').trim();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setDuplicateError('');
    setError('');
    const orig = originalPhone.trim();
    const target = targetPhone.trim();
    if (!orig || !target) return;

    const origNorm = normalizePhone(orig);
    const alreadyExists = list.some(
      (entry) => normalizePhone(entry.originalPhone) === origNorm && entry.id !== editingId
    );
    if (alreadyExists) {
      setDuplicateError(t('phoneBase.duplicateError'));
      return;
    }

    setSaving(true);
    if (editingId) {
      api
        .patch<PhoneBaseEntry>(`/phone-base/${editingId}`, {
          originalPhone: orig,
          targetPhone: target,
          description: description.trim() || undefined,
        })
        .then((updated) => {
          setList((prev) => prev.map((x) => (x.id === editingId ? updated : x)));
          setEditingId(null);
          setOriginalPhone('');
          setTargetPhone('');
          setDescription('');
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Failed to update'))
        .finally(() => setSaving(false));
    } else {
      api
        .post<PhoneBaseEntry>('/phone-base', {
          originalPhone: orig,
          targetPhone: target,
          description: description.trim() || undefined,
        })
        .then((created) => {
          setList((prev) => [created, ...prev]);
          setOriginalPhone('');
          setTargetPhone('');
          setDescription('');
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : '';
          if (msg.includes('unique') || msg.includes('already') || msg.includes('duplicate')) {
            setDuplicateError(t('phoneBase.duplicateError'));
          } else {
            setError(msg || 'Failed to add');
          }
        })
        .finally(() => setSaving(false));
    }
  }

  function startEdit(entry: PhoneBaseEntry) {
    setEditingId(entry.id);
    setOriginalPhone(entry.originalPhone);
    setTargetPhone(entry.targetPhone);
    setDescription(entry.description ?? '');
    setDuplicateError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setOriginalPhone('');
    setTargetPhone('');
    setDescription('');
    setDuplicateError('');
  }

  function handleDelete(id: string) {
    if (!canEdit) return;
    setSaving(true);
    setError('');
    api
      .delete(`/phone-base/${id}`)
      .then(() => setList((prev) => prev.filter((x) => x.id !== id)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to delete'))
      .finally(() => setSaving(false));
  }

  if (!canEdit) {
    return (
      <div className="rd-page phone-base-page">
        <p className="rd-text-muted">{t('auth.staffOnly')}</p>
      </div>
    );
  }

  return (
    <div className="rd-page phone-base-page">
      <h1>{t('phoneBase.title')}</h1>
      <p className="rd-text-muted">{t('phoneBase.subtitle')}</p>
      {error && <p className="rd-text-critical" style={{ marginBottom: '0.75rem' }}>{error}</p>}
      {duplicateError && <p className="rd-text-critical" style={{ marginBottom: '0.75rem' }}>{duplicateError}</p>}

      <form onSubmit={handleSubmit} className="phone-base-form">
        <input
          type="text"
          className="rd-input"
          placeholder={t('phoneBase.originalPhone')}
          value={originalPhone}
          onChange={(e) => { setOriginalPhone(e.target.value); setDuplicateError(''); }}
          required
        />
        <input
          type="text"
          className="rd-input"
          placeholder={t('phoneBase.targetPhone')}
          value={targetPhone}
          onChange={(e) => setTargetPhone(e.target.value)}
          required
        />
        <input
          type="text"
          className="rd-input"
          placeholder={t('phoneBase.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="phone-base-form__actions">
          <button type="submit" className="rd-btn rd-btn-primary" disabled={saving}>
            {editingId ? t('common.save') : t('phoneBase.addNew')}
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
        <p className="rd-text-muted">{t('phoneBase.noEntries')}</p>
      ) : (
        <ul className="phone-base-list">
          {list.map((entry) => (
            <li key={entry.id} className="phone-base-list__item rd-panel">
              <span className="phone-base-list__original">{entry.originalPhone}</span>
              <span className="phone-base-list__arrow">→</span>
              <span className="phone-base-list__target">{entry.targetPhone}</span>
              {entry.description && <span className="phone-base-list__desc">{entry.description}</span>}
              <div className="phone-base-list__actions">
                <button type="button" className="rd-btn rd-btn--small" onClick={() => startEdit(entry)}>
                  {t('common.edit')}
                </button>
                <button type="button" className="rd-btn rd-btn-danger rd-btn--small" onClick={() => handleDelete(entry.id)} disabled={saving}>
                  {t('common.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
