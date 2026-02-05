import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** Timeline, filters, export CSV/JSON. */
export default function LogsAuditMode() {
  const { t } = useTranslation();
  return (
    <div className="logs-mode">
      <nav className="rd-panel" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <Link to="/control">{t('modes.control')}</Link>
        <Link to="/wall">{t('modes.wall')}</Link>
        <Link to="/health">{t('modes.health')}</Link>
        <Link to="/logs">{t('modes.logs')}</Link>
      </nav>
      <div className="rd-panel">
        <div className="rd-panel-header">
          <h1>{t('logs.title')}</h1>
          <button type="button" className="rd-btn">{t('logs.export')}</button>
        </div>
        <p>{t('logs.filter')} — timeline, user, action, resource, export.</p>
      </div>
    </div>
  );
}
