import { useTranslation } from 'react-i18next';

export default function Passengers() {
  const { t } = useTranslation();
  return (
    <div className="rd-panel">
      <div className="rd-panel-header">
        <h1>{t('passengers.title')}</h1>
      </div>
      <p>{t('passengers.phone')}, {t('passengers.addresses')}, {t('passengers.history')}.</p>
    </div>
  );
}
