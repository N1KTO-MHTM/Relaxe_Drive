import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token');

  const [nickname, setNickname] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetDone, setResetDone] = useState(false);
  const [resetting, setResetting] = useState(false);

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

  async function handleResetWithToken(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError(t('roles.passwordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setResetting(true);
    try {
      await api.post('/auth/reset-password', { token: tokenFromUrl, newPassword });
      setResetDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.resetLinkInvalid'));
    } finally {
      setResetting(false);
    }
  }

  if (tokenFromUrl) {
    if (resetDone) {
      return (
        <div className="rd-panel" style={{ maxWidth: 400 }}>
          <h1>{t('auth.forgotPassword')}</h1>
          <p>{t('auth.resetPasswordDone')}</p>
          <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
            <Link to="/login">{t('auth.login')}</Link>
          </p>
        </div>
      );
    }
    return (
      <form onSubmit={handleResetWithToken}>
        <h1>{t('auth.setNewPassword')}</h1>
        {error && <p className="rd-text-critical" style={{ marginBottom: '1rem' }}>{error}</p>}
        <p style={{ color: 'var(--rd-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {t('auth.setNewPasswordHint')}
        </p>
        <div style={{ marginBottom: '1rem' }}>
          <label className="rd-label">{t('auth.password')}</label>
          <input
            type="password"
            className="rd-input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label className="rd-label">{t('auth.confirmPassword')}</label>
          <input
            type="password"
            className="rd-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <button type="submit" className="rd-btn rd-btn-primary" style={{ width: '100%' }} disabled={resetting}>
          {resetting ? '…' : t('auth.setNewPasswordSubmit')}
        </button>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
          <Link to="/login">{t('auth.login')}</Link>
        </p>
      </form>
    );
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
