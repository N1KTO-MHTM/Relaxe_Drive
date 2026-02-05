import { useTranslation } from 'react-i18next';

export default function Calendar() {
  const { t } = useTranslation();
  return (
    <div className="rd-panel">
      <div className="rd-panel-header">
        <h1>{t('calendar.title')}</h1>
      </div>
      <p>Day / Week view, pre-orders up to 6 days, conflict detection, buffer time.</p>
    </div>
  );
}
