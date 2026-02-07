import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Order, OrderRouteData, RouteStep } from '../types';

interface NavigationOverlayProps {
    order: Order;
    routeData: OrderRouteData;
    isPickup: boolean; // true = driving to pickup, false = driving to dropoff
    onClose: () => void;
    onArrived: () => void;
    arriving?: boolean;
}

export default function NavigationOverlay({ order, routeData, isPickup, onClose, onArrived, arriving }: NavigationOverlayProps) {
    const { t } = useTranslation();
    const [showSteps, setShowSteps] = useState(false);

    // Use driverToPickup data if isPickup, else regular route data
    const steps = (isPickup ? routeData.driverToPickupSteps : routeData.steps) || [];
    const durationMin = (isPickup ? routeData.driverToPickupMinutes : routeData.durationMinutes) ?? 0;
    const distanceKm = distanceM => (distanceM / 1000).toFixed(1);
    const totalDistKm = ((isPickup ? routeData.driverToPickupMinutes : routeData.distanceKm) ?? 0).toFixed(1); // distanceKm might be missing in routeData type logic above, trusting prop

    // Simple next step logic: just show the first step or "Head to destination"
    const currentStep = steps.length > 0 ? steps[0] : null;

    return (
        <div className="rd-navigation-overlay" style={{ pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>

            {/* Top Bar: Turn Indicator */}
            <div className="rd-nav-top" style={{ pointerEvents: 'auto', background: '#1f2937', color: 'white', padding: '1rem', margin: '1rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: '400px', width: '100%', alignSelf: 'center' }}>
                <div className="rd-nav-arrow" style={{ fontSize: '2.5rem', lineHeight: 1 }}>
                    {getStepIcon(currentStep?.type || 0)}
                </div>
                <div className="rd-nav-instruction" style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                        {currentStep ? formatDistance(currentStep.distanceM) : ''}
                    </div>
                    <div style={{ fontSize: '1rem', opacity: 0.9 }}>
                        {currentStep?.instruction || (isPickup ? t('dashboard.headToPickup') : t('dashboard.headToDropoff'))}
                    </div>
                </div>
            </div>

            {/* Steps List Modal (Conditional) */}
            {showSteps && (
                <div className="rd-nav-steps-modal" style={{ pointerEvents: 'auto', position: 'absolute', top: '5rem', bottom: '6rem', left: '1rem', right: '1rem', background: 'white', borderRadius: '12px', padding: '1rem', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 1001 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>{t('dashboard.routeSteps')}</h3>
                        <button onClick={() => setShowSteps(false)} className="rd-btn">&times;</button>
                    </div>
                    <ol style={{ paddingLeft: '1.5rem', margin: 0 }}>
                        {steps.map((s, i) => (
                            <li key={i} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                                <div style={{ fontWeight: 500 }}>{s.instruction}</div>
                                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{formatDistance(s.distanceM)}</div>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            {/* Bottom Bar: Compact Stats */}
            <div className="rd-nav-bottom" style={{ pointerEvents: 'auto', background: 'white', padding: '1rem', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', boxShadow: '0 -4px 12px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827' }}>
                            {Math.round(durationMin)} min <span style={{ color: '#6b7280', fontSize: '1rem', fontWeight: 'normal' }}>({totalDistKm} km)</span>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#4b5563', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {isPickup ? order.pickupAddress : order.dropoffAddress}
                        </div>
                    </div>
                    <button
                        onClick={() => setShowSteps(!showSteps)}
                        className="rd-btn"
                        style={{ background: '#f3f4f6', color: '#374151', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', padding: 0 }}
                    >
                        📋
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        className="rd-btn rd-btn-danger"
                        style={{ flex: 0.3 }}
                        onClick={onClose}
                    >
                        {t('common.exit')}
                    </button>
                    <button
                        className="rd-btn rd-btn-primary"
                        style={{ flex: 1, fontSize: '1.1rem', fontWeight: 'bold', padding: '0.75rem' }}
                        onClick={onArrived}
                        disabled={arriving}
                    >
                        {arriving ? '...' : (isPickup ? t('dashboard.arrivedAtPickup') : t('dashboard.complete'))}
                    </button>
                </div>
            </div>
        </div>
    );
}

function formatDistance(meters: number): string {
    if (meters >= 1000) return (meters / 1000).toFixed(1) + ' km';
    return Math.round(meters) + ' m';
}

function getStepIcon(type: number): string {
    // Simple mapping based on OSRM modifier types if available, defaulting to arrows
    // 0: Unknown, 1: Start, 2: End, ...
    // For now return generic arrows
    return '⬆️';
}
