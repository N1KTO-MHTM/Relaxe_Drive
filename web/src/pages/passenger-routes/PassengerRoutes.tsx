import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';
import L from '../../components/leafletWithCluster';
import { api } from '../../api/client';
import './PassengerRoutes.css';

interface OrderWithCoords {
  id: string;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  pickupAt?: string | null;
  status?: string;
  pickupCoords?: { lat: number; lng: number } | null;
  dropoffCoords?: { lat: number; lng: number } | null;
}

export default function PassengerRoutes() {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState<OrderWithCoords[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);

  function search() {
    const q = phone.trim();
    if (!q) {
      setError(t('passengerRoutes.enterPhone'));
      return;
    }
    setError('');
    setLoading(true);
    api
      .get<OrderWithCoords[]>(`/orders/by-phone/${encodeURIComponent(q)}`)
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch((e) => {
        setOrders([]);
        setError(e instanceof Error ? e.message : t('common.error'));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layersRef.current.forEach((layer) => {
      try { map.removeLayer(layer); } catch { /* already removed */ }
    });
    layersRef.current = [];

    const withCoords = orders.filter(
      (o) => o.pickupCoords?.lat != null && o.pickupCoords?.lng != null,
    );
    if (withCoords.length === 0) return;

    const allLatLngs: L.LatLng[] = [];
    const colors = ['#9333ea', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];

    withCoords.forEach((order, i) => {
      const start = order.pickupCoords!;
      const end = order.dropoffCoords;
      const startLatLng = L.latLng(start.lat, start.lng);
      allLatLngs.push(startLatLng);

      const startMarker = L.marker(startLatLng, {
        icon: L.divIcon({
          className: 'passenger-routes-marker passenger-routes-marker-start',
          html: '<span class="passenger-routes-marker-inner">🏁</span>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(map);
      layersRef.current.push(startMarker);

      if (end?.lat != null && end?.lng != null) {
        const endLatLng = L.latLng(end.lat, end.lng);
        allLatLngs.push(endLatLng);
        const line = L.polyline([startLatLng, endLatLng], {
          color: colors[i % colors.length],
          weight: 4,
        }).addTo(map);
        layersRef.current.push(line);
        const endMarker = L.marker(endLatLng, {
          icon: L.divIcon({
            className: 'passenger-routes-marker passenger-routes-marker-end',
            html: '<span class="passenger-routes-marker-inner passenger-routes-marker-dot"></span>',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          }),
        }).addTo(map);
        layersRef.current.push(endMarker);
      }
    });

    if (allLatLngs.length > 0) {
      const bounds = L.latLngBounds(allLatLngs);
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
    }
  }, [orders]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.attribution({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = [];
    };
  }, []);

  return (
    <div className="rd-page passenger-routes-page">
      <div className="passenger-routes-panel">
        <h1>{t('passengerRoutes.title')}</h1>
        <p className="rd-text-muted">{t('passengerRoutes.subtitle')}</p>
        <div className="passenger-routes-search">
          <input
            type="tel"
            className="rd-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder={t('passengerRoutes.phonePlaceholder')}
            aria-label={t('passengerRoutes.phonePlaceholder')}
          />
          <button type="button" className="rd-btn rd-btn-primary" onClick={search} disabled={loading}>
            {loading ? t('common.loading') : t('common.search')}
          </button>
        </div>
        {error && <p className="rd-text-critical" style={{ marginTop: '0.5rem' }}>{error}</p>}
        {orders.length > 0 && (
          <p className="rd-text-muted" style={{ marginTop: '0.5rem' }}>
            {t('passengerRoutes.foundCount', { count: orders.length })}
          </p>
        )}
        {orders.length > 0 && (
          <ul className="passenger-routes-list">
            {orders.slice(0, 10).map((o) => (
              <li key={o.id} className="passenger-routes-list-item">
                <span className="passenger-routes-route">
                  {o.pickupAddress ?? '—'} → {o.dropoffAddress ?? '—'}
                </span>
                {o.pickupAt && (
                  <span className="passenger-routes-meta">
                    {new Date(o.pickupAt).toLocaleString()} · {o.status ?? ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="passenger-routes-map-wrap">
        <div ref={containerRef} className="passenger-routes-map" aria-label="Passenger routes map" />
      </div>
    </div>
  );
}
