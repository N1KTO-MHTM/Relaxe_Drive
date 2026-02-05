import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** Full control — same capabilities as Web Dashboard + system controls. */
export default function ControlMode() {
  const { t } = useTranslation();
  return (
    <div className="control-mode">
      <nav className="rd-panel" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <Link to="/control">{t('modes.control')}</Link>
        <Link to="/wall">{t('modes.wall')}</Link>
        <Link to="/health">{t('modes.health')}</Link>
        <Link to="/logs">{t('modes.logs')}</Link>
      </nav>
      <div className="rd-panel">
        <h1>{t('modes.control')}</h1>
        <p>Full access: map, orders, drivers, calendar, roles, sessions. Local cache & auto-reconnect enabled.</p>
      </div>
    </div>
  );
}
