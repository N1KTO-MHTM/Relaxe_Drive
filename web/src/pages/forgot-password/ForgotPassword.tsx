import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';

export default function ForgotPassword() {
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
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setResetting(true);
    try {
      await api.post('/auth/reset-password', { token: tokenFromUrl, newPassword });
      setResetDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid or expired reset link');
    } finally {
      setResetting(false);
    }
  }

  if (tokenFromUrl) {
    if (resetDone) {
      return (
        <div className="rd-panel" style={{ maxWidth: 400 }}>
          <h1>Forgot password?</h1>
          <p>Password has been reset. You can sign in with your new password.</p>
          <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
            <Link to="/login">Sign in</Link>
          </p>
        </div>
      );
    }
    return (
      <form onSubmit={handleResetWithToken}>
        <h1>Set new password</h1>
        {error && <p className="rd-text-critical" style={{ marginBottom: '1rem' }}>{error}</p>}
        <p style={{ color: 'var(--rd-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Enter and confirm your new password. Link is valid 24 hours.
        </p>
        <div style={{ marginBottom: '1rem' }}>
          <label className="rd-label">Password</label>
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
          <label className="rd-label">Confirm password</label>
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
          {resetting ? '…' : 'Set password'}
        </button>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
          <Link to="/login">Sign in</Link>
        </p>
      </form>
    );
  }

  if (sent) {
    return (
      <div className="rd-panel" style={{ maxWidth: 400 }}>
        <h1>Forgot password?</h1>
        <p>If an account with this nickname exists, contact your administrator to reset the password.</p>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
          <Link to="/login">Sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Forgot password?</h1>
      {error && <p className="rd-text-critical" style={{ marginBottom: '1rem' }}>{error}</p>}
      <p style={{ color: 'var(--rd-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
        Enter your nickname. An administrator can reset your password.
      </p>
      <div style={{ marginBottom: '1rem' }}>
        <label className="rd-label">Nickname</label>
        <input
          type="text"
          className="rd-input"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
        />
      </div>
      <button type="submit" className="rd-btn rd-btn-primary" style={{ width: '100%' }}>
        Request reset
      </button>
      <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
        <Link to="/login">Sign in</Link>
      </p>
    </form>
  );
}
