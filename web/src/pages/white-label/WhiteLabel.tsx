import { useTranslation } from 'react-i18next';

export default function WhiteLabel() {
  const { t } = useTranslation();
  return (
    <div className="rd-page">
      <div className="rd-panel">
        <div className="rd-panel-header">
          <h1>{t('whiteLabel.title')}</h1>
        </div>
        <p>{t('whiteLabel.logo')}, {t('whiteLabel.colors')}, {t('whiteLabel.domains')}, {t('whiteLabel.languages')}.</p>
      </div>
    </div>
  );
}
