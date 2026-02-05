import { useMemo } from 'react';

export interface RouteStep {
  type: number;
  instruction: string;
  distanceM: number;
  durationS: number;
}

interface NavBarProps {
  /** Current leg steps (driver→pickup or pickup→dropoff) */
  steps: RouteStep[];
  /** Total duration of this leg (minutes) */
  durationMinutes?: number;
  /** Phase label: "To pickup" / "To dropoff" */
  phaseLabel: string;
  /** ETA at destination (e.g. "10:45 AM") */
  eta?: string;
}

const STEP_TYPE_ICON: Record<number, string> = {
  0: '↰', 1: '↱', 2: '⤴', 3: '⤵', 4: '←', 5: '→', 6: '↑', 9: '↻', 10: '●', 11: '▶',
};

export default function NavBar({ steps, durationMinutes, phaseLabel, eta }: NavBarProps) {
  const current = useMemo(() => {
    if (!steps.length) return null;
    const first = steps[0];
    const dist = first.distanceM;
    const distStr = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;
    return {
      instruction: first.instruction || (first.type === 11 ? 'Head to destination' : first.type === 10 ? 'Arrive' : 'Continue'),
      distance: distStr,
      icon: STEP_TYPE_ICON[first.type] ?? '↑',
    };
  }, [steps]);

  if (!current && !phaseLabel) return null;

  return (
    <div className="nav-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rd-space-md)', minWidth: 0 }}>
        <span className="nav-bar__icon" aria-hidden>
          {current?.icon ?? '↑'}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--rd-text)' }}>
            {current?.instruction ?? phaseLabel}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--rd-text-muted)' }}>
            {current?.distance && `${current.distance} · `}
            {phaseLabel}
            {eta && ` · ETA ${eta}`}
          </div>
        </div>
      </div>
      {durationMinutes != null && durationMinutes > 0 && (
        <div style={{ fontSize: '0.875rem', color: 'var(--rd-text-muted)', flexShrink: 0 }}>
          ~{Math.round(durationMinutes)} min
        </div>
      )}
    </div>
  );
}
