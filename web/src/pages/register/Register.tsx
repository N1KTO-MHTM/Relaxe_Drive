import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { api } from '../../api/client';

const CAR_TYPES = ['SEDAN', 'MINIVAN', 'SUV'] as const;
const CAR_PLATE_TYPES = ['TAXI', 'TLC', 'PRIVATE', 'OTHER'] as const;

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [carPlateNumber, setCarPlateNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [carType, setCarType] = useState<string>('');
  const [carCapacity, setCarCapacity] = useState<number | ''>('');
  const [carPlateType, setCarPlateType] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [carModelAndYear, setCarModelAndYear] = useState('');
  const [error, setError] = useState('');

  const nickname = [name.trim(), surname.trim()].filter(Boolean).join(' ');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const hasName = name.trim().length > 0;
    const hasSurname = surname.trim().length > 0;
    const hasCarPlateNumber = carPlateNumber.trim().length > 0;
    const hasPhone = phone.trim().length > 0;
    const hasCarType = !!carType;
    const hasCarCapacity = carType && carCapacity !== '' && Number(carCapacity) >= 1;
    const hasCarPlateType = !!carPlateType;
    const hasPassword = password.length > 0;
    const hasEmail = email.trim().length > 0;
    const hasCarModelAndYear = carModelAndYear.trim().length > 0;
    if (!hasName || !hasSurname || !hasCarPlateNumber || !hasPhone || !hasPassword || !hasCarType || !hasCarCapacity || !hasCarPlateType || !hasEmail || !hasCarModelAndYear) {
      setError(t('auth.fillAllRequiredFields'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    try {
      await api.post('/auth/register', {
        nickname,
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        carPlateNumber: carPlateNumber.trim(),
        carPlateType: carPlateType,
        carType: carType || undefined,
        carCapacity: carType && typeof carCapacity === 'number' && carCapacity >= 1 ? carCapacity : undefined,
        carModelAndYear: carModelAndYear.trim(),
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
        <label className="rd-label">{t('auth.name')} *</label>
        <input
          type="text"
          className="rd-input"
          autoComplete="given-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div style={row}>
        <label className="rd-label">{t('auth.surname')} *</label>
        <input
          type="text"
          className="rd-input"
          autoComplete="family-name"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          required
        />
      </div>
      <div style={row}>
        <label className="rd-label">{t('auth.carPlateNumber')} *</label>
        <input
          type="text"
          className="rd-input"
          autoComplete="off"
          value={carPlateNumber}
          onChange={(e) => setCarPlateNumber(e.target.value)}
          placeholder="AB 1234"
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
      {carType && (
        <div style={row}>
          <label className="rd-label">{t('auth.carCapacity')} *</label>
          <input
            type="number"
            min={1}
            max={20}
            className="rd-input"
            value={carCapacity}
            onChange={(e) => setCarCapacity(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            placeholder="4"
            required
          />
        </div>
      )}
      <div style={row}>
        <label className="rd-label">{t('auth.carPlateType')} *</label>
        <select
          className="rd-input"
          value={carPlateType}
          onChange={(e) => setCarPlateType(e.target.value)}
          required
        >
          <option value="">—</option>
          {CAR_PLATE_TYPES.map((type) => (
            <option key={type} value={type}>{t('auth.carPlateType_' + type)}</option>
          ))}
        </select>
      </div>
      <div style={row}>
        <label className="rd-label">{t('auth.password')} *</label>
        <input
          type={showPassword ? 'text' : 'password'}
          className="rd-input"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <div style={row}>
        <label className="rd-label">{t('auth.confirmPassword')} *</label>
        <input
          type={showPassword ? 'text' : 'password'}
          className="rd-input"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', fontSize: '0.8125rem', color: 'var(--rd-text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          <span>{t('auth.showPassword')}</span>
        </label>
      </div>

      <div style={row}>
        <label className="rd-label">{t('auth.email')} *</label>
        <input type="email" className="rd-input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" required />
      </div>
      <div style={row}>
        <label className="rd-label">{t('auth.carModelAndYear')} *</label>
        <input type="text" className="rd-input" autoComplete="off" value={carModelAndYear} onChange={(e) => setCarModelAndYear(e.target.value)} placeholder="Toyota Camry 2020" required />
      </div>

      <button
        type="submit"
        className="rd-btn rd-btn-primary"
        style={{ width: '100%' }}
        disabled={!name.trim() || !surname.trim() || !carPlateNumber.trim() || !phone.trim() || !carType || (carType && (carCapacity === '' || (typeof carCapacity === 'number' && carCapacity < 1))) || !carPlateType || !email.trim() || !carModelAndYear.trim() || !password || !confirmPassword}
      >
        {t('auth.register')}
      </button>
      <p style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>
        <Link to="/login">{t('auth.login')}</Link>
      </p>
    </form>
  );
}
