import { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { api } from '../api/client';
import { Order } from '../types';

interface DriverTripsModalProps {
    driverId: string;
    driverName?: string;
    onClose: () => void;
}

function shortAddress(addr: string | null | undefined, maxLen = 42): string {
    if (!addr) return '';
    const parts = addr.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1) return addr.length <= maxLen ? addr : addr.slice(0, maxLen).trim() + '…';
    const short = [parts[0], parts[1]].join(', ');
    return short.length <= maxLen ? short : short.slice(0, maxLen).trim() + '…';
}

export default function DriverTripsModal({ driverId, driverName, onClose }: DriverTripsModalProps) {
    const { t } = useTranslation();
    const [trips, setTrips] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTrips = async () => {
            setLoading(true);
            try {
                // Fetch last 30 days
                const to = new Date();
                const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
                // Note: Check if backend supports driverId filter, otherwise filter locally
                // Assuming /orders supports standard filters or we filter client side
                const data = await api.get<Order[]>(`/orders?from=${from.toISOString()}&to=${to.toISOString()}`);
                if (Array.isArray(data)) {
                    // Filter by driverId and COMPLETED status
                    const driverTrips = data
                        .filter(o => o.driverId === driverId && o.status === 'COMPLETED')
                        .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());
                    setTrips(driverTrips);
                }
            } catch (err) {
                console.error('Failed to load trips', err);
            } finally {
                setLoading(false);
            }
        };
        fetchTrips();
    }, [driverId]);

    return (
        <div className="rd-modal-overlay" onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
        }}>
            <div className="rd-panel" onClick={e => e.stopPropagation()} style={{
                maxWidth: 600, width: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: '1.5rem', borderRadius: '8px', background: 'white'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>{t('dashboard.tripHistory')} - {driverName || 'Driver'}</h3>
                    <button onClick={onClose} className="rd-btn rd-btn-text" style={{ fontSize: '1.5rem', padding: '0 0.5rem' }}>&times;</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>{t('common.loading')}</div>
                    ) : trips.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>{t('dashboard.noCompletedOrders')}</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#6b7280' }}>
                                    <th style={{ padding: '0.5rem' }}>{t('dashboard.timeDroppedOff')}</th>
                                    <th style={{ padding: '0.5rem' }}>{t('dashboard.route')}</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t('dashboard.earnings')}</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t('dashboard.distance')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trips.map(trip => (
                                    <tr key={trip.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '0.5rem' }}>
                                            {trip.completedAt ? new Date(trip.completedAt).toLocaleDateString() + ' ' + new Date(trip.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </td>
                                        <td style={{ padding: '0.5rem' }}>
                                            <div style={{ fontWeight: 500 }}>{shortAddress(trip.pickupAddress)}</div>
                                            <div style={{ color: '#6b7280', fontSize: '0.8em' }}>→ {shortAddress(trip.dropoffAddress)}</div>
                                        </td>
                                        <td style={{ padding: '0.5rem', textAlign: 'right', color: '#9ca3af' }}>—</td>
                                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                            {trip.distanceKm ? (trip.distanceKm / 1.609).toFixed(1) + ' mi' : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                    <button onClick={onClose} className="rd-btn">{t('common.close')}</button>
                </div>
            </div>
        </div>
    );
}
