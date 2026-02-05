import DesktopLayout from '../layouts/DesktopLayout';

/** Read-only big screen: map, ETA, alerts. */
export default function LiveWallMode() {
  return (
    <DesktopLayout fullHeight>
      <div className="wall-mode rd-map-container" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rd-text-muted)' }}>
        Live Wall — Map, ETA, Alerts (read-only)
      </div>
    </DesktopLayout>
  );
}
