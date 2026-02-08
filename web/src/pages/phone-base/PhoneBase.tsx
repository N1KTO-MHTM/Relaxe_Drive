import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface PhoneMapping {
    id: string;
    originalPhone: string;
    targetPhone: string;
    description?: string;
}

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
    const map = useMap();
    useEffect(() => {
        if (bounds) map.fitBounds(bounds, { padding: [50, 50] });
    }, [bounds, map]);
    return null;
}

function PhoneRoutesModal({ phone, onClose }: { phone: string; onClose: () => void }) {
    const { t } = useTranslation();
    const [routes, setRoutes] = useState<Array<{
        id: string;
        pickupAt: string;
        pickupAddress: string;
        dropoffAddress: string;
        pickupCoords?: { lat: number; lng: number };
        dropoffCoords?: { lat: number; lng: number };
    }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get<any[]>(`/orders/by-phone/${encodeURIComponent(phone)}`)
            .then((data) => {
                setRoutes(Array.isArray(data) ? data : []);
            })
            .catch(() => setRoutes([]))
            .finally(() => setLoading(false));
    }, [phone]);

    const bounds = useMemo(() => {
        if (routes.length === 0) return null;
        const lats: number[] = [];
        const lngs: number[] = [];
        routes.forEach((r) => {
            if (r.pickupCoords) { lats.push(r.pickupCoords.lat); lngs.push(r.pickupCoords.lng); }
            if (r.dropoffCoords) { lats.push(r.dropoffCoords.lat); lngs.push(r.dropoffCoords.lng); }
        });
        if (lats.length === 0) return null;
        return [
            [Math.min(...lats), Math.min(...lngs)],
            [Math.max(...lats), Math.max(...lngs)],
        ] as L.LatLngBoundsExpression;
    }, [routes]);

    return (
        <div className="rd-modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div className="rd-panel" style={{ width: '90%', maxWidth: '800px', height: '80vh', display: 'flex', flexDirection: 'column', padding: 0, background: 'white', borderRadius: '8px', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
                <div className="rd-panel-header" style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Routes for {phone}</h3>
                    <button className="rd-btn" onClick={onClose} style={{ padding: '0.5rem 1rem' }}>{t('common.close')}</button>
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                    {loading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.7)', zIndex: 1000 }}>Loading...</div>}
                    {!loading && routes.length === 0 && <div style={{ padding: '2rem', textAlign: 'center' }}>No route history found with coordinates.</div>}
                    {!loading && (
                        <MapContainer style={{ height: '100%', width: '100%' }} center={[41.1171, -74.043]} zoom={13}>
                            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                            {bounds && <FitBounds bounds={bounds} />}
                            {routes.map((r, i) => (
                                <div key={r.id}>
                                    {r.pickupCoords && (
                                        <Marker position={r.pickupCoords}>
                                            <Popup>
                                                <strong>Pickup {i + 1}</strong><br />
                                                {new Date(r.pickupAt).toLocaleString()}<br />
                                                {r.pickupAddress}
                                            </Popup>
                                        </Marker>
                                    )}
                                    {r.dropoffCoords && (
                                        <Marker position={r.dropoffCoords}>
                                            <Popup>
                                                <strong>Dropoff {i + 1}</strong><br />
                                                {r.dropoffAddress}
                                            </Popup>
                                        </Marker>
                                    )}
                                    {r.pickupCoords && r.dropoffCoords && (
                                        <Polyline positions={[r.pickupCoords, r.dropoffCoords]} color="blue" weight={2} opacity={0.6} />
                                    )}
                                </div>
                            ))}
                        </MapContainer>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function PhoneBase() {
    const { t } = useTranslation();
    const [mappings, setMappings] = useState<PhoneMapping[]>([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ originalPhone: '', targetPhone: '', description: '' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [viewingPhone, setViewingPhone] = useState<string | null>(null);

    const fetchMappings = async () => {
        setLoading(true);
        try {
            const res = await api.get<PhoneMapping[]>('/phone-base');
            setMappings(res);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMappings();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.patch(`/phone-base/${editingId}`, formData);
            } else {
                await api.post('/phone-base', formData);
            }
            setFormData({ originalPhone: '', targetPhone: '', description: '' });
            setEditingId(null);
            fetchMappings();
        } catch (error) {
            console.error(error);
            alert('Failed to save mapping');
        }
    };

    const handleEdit = (m: PhoneMapping) => {
        setFormData({ originalPhone: m.originalPhone, targetPhone: m.targetPhone, description: m.description || '' });
        setEditingId(m.id);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(t('Are you sure?'))) return;
        try {
            await api.delete(`/phone-base/${id}`);
            fetchMappings();
        } catch (error) {
            console.error(error);
        }
    };

    const handleCancel = () => {
        setFormData({ originalPhone: '', targetPhone: '', description: '' });
        setEditingId(null);
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">{t('Phone Base (Transferred Numbers)')}</h1>

            <div className="bg-white dark:bg-gray-800 p-4 rounded shadow mb-8">
                <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
                    {editingId ? t('Edit Mapping') : t('Add New Mapping')}
                </h2>
                <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('Original Phone')}</label>
                        <input
                            type="text"
                            required
                            className="border p-2 rounded w-48 dark:bg-gray-700 dark:text-white"
                            value={formData.originalPhone}
                            onChange={e => setFormData({ ...formData, originalPhone: e.target.value })}
                            placeholder="+1..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('Target Phone')}</label>
                        <input
                            type="text"
                            required
                            className="border p-2 rounded w-48 dark:bg-gray-700 dark:text-white"
                            value={formData.targetPhone}
                            onChange={e => setFormData({ ...formData, targetPhone: e.target.value })}
                            placeholder="+1..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('Description')}</label>
                        <input
                            type="text"
                            className="border p-2 rounded w-64 dark:bg-gray-700 dark:text-white"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="e.g. Old number of Client X"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                            {editingId ? t('Update') : t('Add')}
                        </button>
                        {editingId && (
                            <button type="button" onClick={handleCancel} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                                {t('Cancel')}
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('Original Phone')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('Target Phone')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('Description')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('Actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr><td colSpan={4} className="text-center py-4">{t('Loading...')}</td></tr>
                        ) : mappings.length === 0 ? (
                            <tr><td colSpan={4} className="text-center py-4 text-gray-500">{t('No mappings found')}</td></tr>
                        ) : (
                            mappings.map((m) => (
                                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">{m.originalPhone}</span>
                                            <button
                                                type="button"
                                                className="text-gray-400 hover:text-gray-600"
                                                onClick={() => navigator.clipboard.writeText(m.originalPhone)}
                                                title="Copy"
                                            >
                                                📋
                                            </button>
                                            <button
                                                type="button"
                                                className="text-blue-600 hover:text-blue-800 text-xs bg-blue-50 px-2 py-1 rounded"
                                                onClick={() => setViewingPhone(m.originalPhone)}
                                            >
                                                Map
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">{m.targetPhone}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{m.description}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleEdit(m)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4">
                                            {t('Edit')}
                                        </button>
                                        <button onClick={() => handleDelete(m.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                                            {t('Delete')}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {viewingPhone && <PhoneRoutesModal phone={viewingPhone} onClose={() => setViewingPhone(null)} />}
        </div>
    );
}
