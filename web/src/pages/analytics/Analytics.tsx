import { useTranslation } from 'react-i18next';

export default function Analytics() {
  const { t } = useTranslation();
  return (
    <div className="rd-panel">
      <div className="rd-panel-header">
        <h1>{t('analytics.title')}</h1>
      </div>
      <p>{t('analytics.heatmap')}, {t('analytics.filters')}.</p>
    </div>
  );
}
