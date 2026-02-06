import { useTranslation } from 'react-i18next';
import DesktopLayout from '../layouts/DesktopLayout';

export default function TranslationMode() {
  const { t } = useTranslation();
  return (
    <DesktopLayout>
      <div className="translation-mode">
        <div className="rd-panel-header">
          <h1>{t('translation.title')}</h1>
        </div>
        <p className="rd-text-muted">
          {t('translation.voiceToText')}, {t('translation.autoLanguage')}, {t('translation.history')}.
        </p>
      </div>
    </DesktopLayout>
  );
}
