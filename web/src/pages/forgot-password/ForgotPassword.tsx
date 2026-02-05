import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [nickname, setNickname] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/forgot-password', { nickname });
      setSent(true);
    } catch {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="rd-panel" style={{ maxWidth: 400 }}>
        <h1>{t('auth.forgotPassword')}</h1>
        <p>{t('auth.forgotPasswordSent')}</p>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
          <Link to="/login">{t('auth.login')}</Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>{t('auth.forgotPassword')}</h1>
      {error && <p className="rd-text-critical" style={{ marginBottom: '1rem' }}>{error}</p>}
      <p style={{ color: 'var(--rd-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
        {t('auth.forgotPasswordHint')}
      </p>
      <div style={{ marginBottom: '1rem' }}>
        <label className="rd-label">{t('auth.nickname')}</label>
        <input
          type="text"
          className="rd-input"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
        />
      </div>
      <button type="submit" className="rd-btn rd-btn-primary" style={{ width: '100%' }}>
        {t('auth.forgotPasswordSubmit')}
      </button>
      <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
        <Link to="/login">{t('auth.login')}</Link>
      </p>
    </form>
  );
}
