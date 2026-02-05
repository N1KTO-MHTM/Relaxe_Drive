import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
      const device = 'RelaxDrive Desktop';
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, password, device, rememberDevice }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        throw new Error(msg || 'Invalid credentials');
      }
      const data = await res.json();
      if (data.user?.role === 'DRIVER') {
        setError(t('auth.driversUseWeb') ?? 'Drivers should use the web app. Desktop is for dispatchers and admins.');
        return;
      }
      setAuth(data.accessToken, data.refreshToken, data.user);
      navigate('/control', { replace: true });
    } catch (err) {
      const isNetwork = err instanceof Error && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'));
      setError(isNetwork ? (t('auth.serverError') ?? 'Server unavailable') : (t('auth.invalidCredentials') ?? 'Invalid nickname or password'));
    }
  }

  return (
    <div className="auth-layout" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="rd-panel" style={{ maxWidth: 400, width: '100%' }}>
        <h1>{t('auth.login')}</h1>
        {error && <p className="status-critical">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label>{t('auth.nickname')}</label>
            <input type="text" className="rd-input" autoComplete="username" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>{t('auth.password')}</label>
            <input type={showPassword ? 'text' : 'password'} className="rd-input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--rd-text-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
              <span>{t('auth.showPassword')}</span>
            </label>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} />
            <span>{t('auth.rememberDevice')}</span>
          </label>
          <button type="submit" className="rd-btn rd-btn-primary" style={{ width: '100%' }}>{t('auth.login')}</button>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            <Link to="/forgot-password">{t('auth.forgotPassword')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
