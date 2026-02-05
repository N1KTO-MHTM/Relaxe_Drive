import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore, type Role } from '../../store/auth';
import { api } from '../../api/client';
import './Login.css';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const device = typeof navigator !== 'undefined' ? `Web (${navigator.userAgent.slice(0, 80)}${navigator.userAgent.length > 80 ? '…' : ''})` : 'Web';
      const data = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; nickname: string; role: string; locale: string };
      }>('/auth/login', { nickname, password, device, rememberDevice });
      setAuth(data.accessToken, data.refreshToken, { ...data.user, role: data.user.role as Role });
      if (data.user?.locale) {
        const i18nModule = await import('../../i18n');
        i18nModule.default.changeLanguage(data.user.locale);
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const isNetwork = msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed');
      setError(isNetwork ? t('auth.serverError') : (msg || t('auth.invalidCredentials')));
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>{t('auth.login')}</h1>
      <p className="rd-text-muted" style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>{t('auth.staffOnly')}</p>
      {error && (
        <p className="rd-text-critical" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          {error}
          <button type="button" className="rd-btn rd-btn-link" onClick={() => setError('')}>
            {t('auth.retry')}
          </button>
        </p>
      )}
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
      <div className="login-password-wrap" style={{ marginBottom: '1rem' }}>
        <label className="rd-label">{t('auth.password')}</label>
        <div className="login-password-row">
          <input
            type={showPassword ? 'text' : 'password'}
            className="rd-input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <label className="login-show-password">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              aria-label={t('auth.showPassword')}
            />
            <span>{t('auth.showPassword')}</span>
          </label>
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', cursor: 'pointer', fontSize: '0.875rem' }}>
        <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} />
        <span>{t('auth.rememberDevice')}</span>
      </label>
      <button type="submit" className="rd-btn rd-btn-primary" style={{ width: '100%' }}>
        {t('auth.login')}
      </button>
      <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
        <Link to="/forgot-password">{t('auth.forgotPassword')}</Link>
      </p>
      <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
        <Link to="/register">{t('auth.register')}</Link>
      </p>
    </form>
  );
}
