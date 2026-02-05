import { useTranslation } from 'react-i18next';
import DesktopLayout from '../layouts/DesktopLayout';

/** Full control — same capabilities as Web Dashboard + system controls. */
export default function ControlMode() {
  const { t } = useTranslation();
  return (
    <DesktopLayout>
      <div className="control-mode">
        <div className="rd-panel">
          <h1>{t('modes.control')}</h1>
          <p>Full access: map, orders, drivers, calendar, roles, sessions. Local cache &amp; auto-reconnect enabled.</p>
        </div>
      </div>
    </DesktopLayout>
  );
}
