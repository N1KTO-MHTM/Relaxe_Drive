import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** Read-only big screen: map, ETA, alerts. */
export default function LiveWallMode() {
  const { t } = useTranslation();
  return (
    <div className="wall-mode">
      <nav style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, display: 'flex', gap: 8 }}>
        <Link to="/control">{t('modes.control')}</Link>
        <Link to="/wall">{t('modes.wall')}</Link>
        <Link to="/health">{t('modes.health')}</Link>
        <Link to="/logs">{t('modes.logs')}</Link>
      </nav>
      <div className="rd-map-container" style={{ height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--rd-text-dim)' }}>
          Live Wall — Map, ETA, Alerts (read-only)
        </div>
      </div>
    </div>
  );
}
