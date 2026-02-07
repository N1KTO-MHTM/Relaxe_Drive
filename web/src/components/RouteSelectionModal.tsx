import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

interface RouteResult {
    polyline: string;
    durationMinutes: number;
    distanceKm: number;
}

interface RouteSelectionModalProps {
    pickupAddress: string;
    dropoffAddress: string;
    onSelect: (routeIndex: number, route: RouteResult) => void;
    onCancel: () => void;
}

export default function RouteSelectionModal({ pickupAddress, dropoffAddress, onSelect, onCancel }: RouteSelectionModalProps) {
    const { t } = useTranslation();
    const [routes, setRoutes] = useState<RouteResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIdx, setSelectedIdx] = useState(0);

    useEffect(() => {
        let active = true;
        setLoading(true);
        api.get<RouteResult[]>(`/geo/route-alternatives?origin=${encodeURIComponent(pickupAddress)}&destination=${encodeURIComponent(dropoffAddress)}`)
            .then((data) => {
                if (active && Array.isArray(data)) {
                    setRoutes(data);
                    if (data.length > 0) setSelectedIdx(0);
                }
            })
            .catch((err) => console.error(err))
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [pickupAddress, dropoffAddress]);

    const handleConfirm = () => {
        if (routes[selectedIdx]) {
            onSelect(selectedIdx, routes[selectedIdx]);
        } else {
            // Fallback
            onSelect(0, { polyline: '', durationMinutes: 0, distanceKm: 0 });
        }
    };

    return (
        <div className="rd-modal-overlay" style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
            <div className="rd-panel" style={{ width: '400px', maxWidth: '90%', padding: '1.5rem', background: '#fff', borderRadius: '8px' }}>
                <h3 style={{ marginTop: 0 }}>{t('dashboard.selectRoute') || 'Select Route'}</h3>

                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                        Loading routes...
                    </div>
                ) : routes.length === 0 ? (
                    <div style={{ padding: '1rem', color: '#ef4444' }}>
                        No routes found.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', margin: '1rem 0' }}>
                        {routes.map((route, idx) => (
                            <div
                                key={idx}
                                onClick={() => setSelectedIdx(idx)}
                                style={{
                                    padding: '1rem',
                                    border: selectedIdx === idx ? '2px solid #2563eb' : '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    background: selectedIdx === idx ? '#eff6ff' : '#fff',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 600, color: '#111827' }}>
                                        Route {idx + 1}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                        {formatDistance(route.distanceKm)}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, color: '#059669' }}>
                                        {Math.round(route.durationMinutes)} min
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '0.5rem 1rem', background: 'transparent', border: '1px solid #d1d5db',
                            borderRadius: '6px', cursor: 'pointer'
                        }}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading || routes.length === 0}
                        style={{
                            padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none',
                            borderRadius: '6px', cursor: 'pointer', opacity: (loading || routes.length === 0) ? 0.5 : 1
                        }}
                    >
                        {t('common.confirm') || 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function formatDistance(km: number) {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
}
