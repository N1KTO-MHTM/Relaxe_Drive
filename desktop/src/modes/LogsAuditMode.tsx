import { useTranslation } from 'react-i18next';
import DesktopLayout from '../layouts/DesktopLayout';

/** Timeline, filters, export CSV/JSON. */
export default function LogsAuditMode() {
  const { t } = useTranslation();
  return (
    <DesktopLayout>
      <div className="logs-mode">
        <div className="rd-panel">
          <div className="rd-panel-header">
            <h1>{t('logs.title')}</h1>
            <button type="button" className="rd-btn">{t('logs.export')}</button>
          </div>
          <p>{t('logs.filter')} — timeline, user, action, resource, export.</p>
        </div>
      </div>
    </DesktopLayout>
  );
}
