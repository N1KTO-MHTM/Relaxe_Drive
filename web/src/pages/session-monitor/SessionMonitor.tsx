import { useTranslation } from 'react-i18next';

export default function SessionMonitor() {
  const { t } = useTranslation();
  return (
    <div className="rd-panel">
      <div className="rd-panel-header">
        <h1>{t('sessions.title')}</h1>
      </div>
      <p>{t('sessions.online')}, {t('sessions.device')}, {t('sessions.ip')}, {t('sessions.lastActive')}.</p>
    </div>
  );
}
