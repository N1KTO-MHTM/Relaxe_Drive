import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

interface WhiteLabelConfig {
  id?: string;
  tenantId?: string;
  logoUrl: string | null;
  primaryColor: string | null;
  domain: string | null;
  locales: string;
}

export default function WhiteLabel() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [domain, setDomain] = useState('');
  const [locales, setLocales] = useState('en,ru,ka');

  function loadConfig() {
    setLoading(true);
    setError(null);
    api
      .get<WhiteLabelConfig | null>('/white-label')
      .then((data) => {
        if (data && typeof data === 'object') {
          setLogoUrl(data.logoUrl ?? '');
          setPrimaryColor(data.primaryColor ?? '');
          setDomain(data.domain ?? '');
          setLocales(data.locales ?? 'en,ru,ka');
        } else {
          setDomain('');
          setLogoUrl('');
          setPrimaryColor('');
          setLocales('en,ru,ka');
        }
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : t('whiteLabel.loadError');
        if (msg.includes('JSON') || msg.includes('end of JSON')) {
          setDomain('');
          setLogoUrl('');
          setPrimaryColor('');
          setLocales('en,ru,ka');
        } else setError(msg);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadConfig();
  }, [t]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    api
      .put<WhiteLabelConfig>('/white-label', {
        logoUrl: logoUrl.trim() || null,
        primaryColor: primaryColor.trim() || null,
        domain: domain.trim() || null,
        locales: locales.trim() || 'en,ru,ka',
      })
      .then(() => {
        setMessage(t('whiteLabel.saved'));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to save'))
      .finally(() => setSaving(false));
  }

  if (loading) {
    return (
      <div className="rd-page">
        <div className="rd-panel">
          <div className="rd-panel-header">
            <h1>{t('whiteLabel.title')}</h1>
          </div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rd-page">
      <div className="rd-panel">
        <div className="rd-panel-header">
          <h1>{t('whiteLabel.title')}</h1>
          <button type="button" className="rd-btn rd-btn-secondary" onClick={loadConfig} disabled={loading}>
            {t('common.refresh')}
          </button>
        </div>
        <p className="rd-text-muted">
          {t('whiteLabel.logo')}, {t('whiteLabel.colors')}, {t('whiteLabel.domains')}, {t('whiteLabel.languages')}.
        </p>
        {error && <p className="rd-error">{error}</p>}
        {message && <p className="rd-success" style={{ color: 'var(--rd-success, #6a6)' }}>{message}</p>}

        <form onSubmit={handleSubmit} style={{ marginTop: '1rem', maxWidth: 400 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
            <span>{t('whiteLabel.logoUrl')}</span>
            <input
              type="url"
              className="rd-input"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
            <span>{t('whiteLabel.primaryColor')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="color"
                value={primaryColor || '#2563eb'}
                onChange={(e) => setPrimaryColor(e.target.value)}
                style={{ width: 40, height: 36, padding: 2, cursor: 'pointer' }}
              />
              <input
                type="text"
                className="rd-input"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#2563eb"
                style={{ flex: 1 }}
              />
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
            <span>{t('whiteLabel.domain')}</span>
            <input
              type="text"
              className="rd-input"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="app.example.com"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
            <span>{t('whiteLabel.locales')}</span>
            <input
              type="text"
              className="rd-input"
              value={locales}
              onChange={(e) => setLocales(e.target.value)}
              placeholder="en,ru,ka,es"
            />
          </label>
          <button type="submit" className="rd-btn rd-btn-primary" disabled={saving}>
            {saving ? t('analytics.loading') : t('whiteLabel.save')}
          </button>
        </form>
      </div>
    </div>
  );
}
