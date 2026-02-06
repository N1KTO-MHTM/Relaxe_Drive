import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

const CAR_TYPES = ['SEDAN', 'MINIVAN', 'SUV'] as const;

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [carPlateNumber, setCarPlateNumber] = useState('');
  const [carType, setCarType] = useState<string>('');
  const [carCapacity, setCarCapacity] = useState<number | ''>('');
  const [carModelAndYear, setCarModelAndYear] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const hasNickname = nickname.trim().length > 0;
    const hasPhone = phone.trim().length > 0;
    const hasPassword = password.length > 0;
    const hasCarType = !!carType;
    if (!hasNickname || !hasPhone || !hasPassword || !hasCarType) {
      setError(t('auth.fillAllRequiredFields'));
      return;
    }
    try {
      await api.post('/auth/register', {
        nickname,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
        carPlateNumber: carPlateNumber.trim() || undefined,
        carType: carType || undefined,
        carCapacity: carType && carCapacity !== '' ? Number(carCapacity) : undefined,
        carModelAndYear: carModelAndYear.trim() || undefined,
      });
      navigate('/login', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const isNetwork = msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed');
      setError(isNetwork ? t('auth.serverError') : (msg || t('auth.registerFailed')));
    }
  }

  const row = { marginBottom: '0.75rem' };

  return (
    <form onSubmit={handleSubmit}>
      <h1>{t('auth.register')}</h1>
      <p className="rd-text-muted" style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>{t('auth.registerDriverOnly')}</p>
      {error && <p className="rd-text-critical" style={{ marginBottom: '0.75rem' }}>{error}</p>}
      <div style={row}>
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
      <div style={row}>
        <label className="rd-label">{t('auth.phone')} *</label>
        <input
          type="tel"
          className="rd-input"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t('auth.phonePlaceholder')}
          required
        />
      </div>
      <div style={row}>
        <label className="rd-label">{t('auth.carType')} *</label>
        <select
          className="rd-input"
          value={carType}
          onChange={(e) => { setCarType(e.target.value); if (!e.target.value) setCarCapacity(''); }}
          required
        >
          <option value="">—</option>
          {CAR_TYPES.map((type) => (
            <option key={type} value={type}>{t('auth.carType_' + type)}</option>
          ))}
        </select>
      </div>
      <div style={row}>
        <label className="rd-label">{t('auth.password')}</label>
        <input
          type={showPassword ? 'text' : 'password'}
          className="rd-input"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', fontSize: '0.8125rem', color: 'var(--rd-text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          <span>{t('auth.showPassword')}</span>
        </label>
      </div>
      <details open style={{ marginBottom: '0.75rem' }}>
        <summary className="rd-text-muted" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>{t('auth.email')}, {t('auth.carPlateNumber')}, {t('auth.carModelAndYear')}</summary>
        <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.5rem' }}>
          <div>
            <label className="rd-label">{t('auth.email')}</label>
            <input type="email" className="rd-input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" />
          </div>
          <div>
            <label className="rd-label">{t('auth.carPlateNumber')}</label>
            <input type="text" className="rd-input" autoComplete="off" value={carPlateNumber} onChange={(e) => setCarPlateNumber(e.target.value)} placeholder="AB 1234" />
          </div>
          {carType && (
            <div>
              <label className="rd-label">{t('auth.carCapacity')}</label>
              <input type="number" min={1} max={20} className="rd-input" value={carCapacity} onChange={(e) => setCarCapacity(e.target.value === '' ? '' : parseInt(e.target.value, 10))} placeholder="4" />
            </div>
          )}
          <div>
            <label className="rd-label">{t('auth.carModelAndYear')}</label>
            <input type="text" className="rd-input" autoComplete="off" value={carModelAndYear} onChange={(e) => setCarModelAndYear(e.target.value)} placeholder="Toyota Camry 2020" />
          </div>
        </div>
      </details>
      <button
        type="submit"
        className="rd-btn rd-btn-primary"
        style={{ width: '100%' }}
        disabled={!nickname.trim() || !password || !phone.trim() || !carType}
      >
        {t('auth.register')}
      </button>
      <p style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>
        <Link to="/login">{t('auth.login')}</Link>
      </p>
    </form>
  );
}
