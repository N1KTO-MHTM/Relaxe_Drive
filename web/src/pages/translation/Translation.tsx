import { useTranslation } from 'react-i18next';

export default function Translation() {
  const { t } = useTranslation();
  return (
    <div className="rd-page">
      <div className="rd-premium-panel">
        <div className="rd-panel-header">
          <h1>{t('translation.title')}</h1>
        </div>
        <p>{t('translation.voiceToText')}, {t('translation.autoLanguage')}, {t('translation.history')}.</p>
      </div>
    </div>
  );
}
