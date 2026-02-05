import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/register', { nickname, phone: phone.trim() || undefined, password, role: 'DISPATCHER' });
      navigate('/login', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const isNetwork = msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed');
      setError(isNetwork ? t('auth.serverError') : (msg || t('auth.registerFailed')));
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>{t('auth.register')}</h1>
      {error && <p className="rd-text-critical" style={{ marginBottom: '1rem' }}>{error}</p>}
      <div style={{ marginBottom: '1rem' }}>
        <label className="rd-label">{t('auth.nickname')}</label>
        <input
          type="text"
          className="rd-input"
          autoComplete="username"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
        />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label className="rd-label">{t('auth.phone')}</label>
        <input
          type="tel"
          className="rd-input"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7 999 123-45-67"
        />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label className="rd-label">{t('auth.password')}</label>
        <input
          type={showPassword ? 'text' : 'password'}
          className="rd-input"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--rd-text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          <span>{t('auth.showPassword')}</span>
        </label>
      </div>
      <button type="submit" className="rd-btn rd-btn-primary" style={{ width: '100%' }}>
        {t('auth.register')}
      </button>
      <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
        <Link to="/login">{t('auth.login')}</Link>
      </p>
    </form>
  );
}
