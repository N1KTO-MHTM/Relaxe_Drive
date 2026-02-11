import { useTranslation } from '../../i18n';
import './Statements.css';

export default function Statements() {
  const { t } = useTranslation();

  return (
    <div className="rd-page">
      <div className="statements-page rd-premium-panel">
        <h1>{t('statements.title')}</h1>
        <p className="rd-text-muted">{t('statements.description')}</p>
        <p className="rd-text-muted statements-placeholder">{t('statements.placeholder')}</p>
      </div>
    </div>
  );
}
