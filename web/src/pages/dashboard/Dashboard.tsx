import { useTranslation } from 'react-i18next';
import { useSocket } from '../../ws/useSocket';
import './Dashboard.css';

export default function Dashboard() {
  const { t } = useTranslation();
  const { connected } = useSocket();

  return (
    <div className="dashboard-page">
      <div className="dashboard-page__top">
        <h1>{t('dashboard.title')}</h1>
        <span className={`rd-badge ${connected ? 'rd-badge-ok' : 'rd-badge-critical'}`}>
          WS {connected ? t('status.ok') : 'Offline'}
        </span>
      </div>
      <div className="dashboard-page__grid">
        <aside className="dashboard-page__sidebar rd-panel">
          <div className="rd-panel-header">
            <h2>{t('dashboard.orders')}</h2>
          </div>
          <p className="rd-text-muted">Active and scheduled orders list — drag & drop to assign.</p>
        </aside>
        <div className="dashboard-page__map rd-map-container">
          <div className="map-placeholder">
            Live Map — drivers, orders, ETA / AI ETA
          </div>
        </div>
        <aside className="dashboard-page__sidebar rd-panel">
          <div className="rd-panel-header">
            <h2>{t('dashboard.drivers')}</h2>
          </div>
          <p className="rd-text-muted">Driver statuses and {t('dashboard.alerts')}.</p>
        </aside>
      </div>
    </div>
  );
}
