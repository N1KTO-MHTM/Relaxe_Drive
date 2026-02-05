import { useTranslation } from 'react-i18next';

export default function Roles() {
  const { t } = useTranslation();
  return (
    <div className="rd-panel">
      <div className="rd-panel-header">
        <h1>{t('roles.title')}</h1>
      </div>
      <p>{t('roles.admin')}, {t('roles.dispatcher')}, {t('roles.driver')} — permission matrix.</p>
    </div>
  );
}
