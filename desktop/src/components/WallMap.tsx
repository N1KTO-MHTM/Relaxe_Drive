import { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';

const DEFAULT_CENTER: [number, number] = [41.1112, -74.0438]; // Spring Valley, NY (USA)
const DEFAULT_ZOOM = 10;

interface Driver {
  id: string;
  nickname: string;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  role: string;
}

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

export default function WallMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;
    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get<Driver[]>('/users').then((data) => {
      setDrivers(Array.isArray(data) ? data.filter((u) => u.role === 'DRIVER') : []);
    }).catch(() => setDrivers([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const withCoords = drivers.filter((d) => d.lat != null && d.lng != null && Number.isFinite(d.lat) && Number.isFinite(d.lng));
    withCoords.forEach((driver) => {
      const marker = L.marker([driver.lat!, driver.lng!], { icon: defaultIcon }).addTo(map);
      const name = driver.nickname || 'Driver';
      const phone = driver.phone ? `<br/>${String(driver.phone).replace(/</g, '&lt;')}` : '';
      marker.bindPopup(`<strong>${String(name).replace(/</g, '&lt;')}</strong>${phone}`);
      markersRef.current.push(marker);
    });
  }, [drivers]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 400 }}>
      {loading && (
        <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1000, background: 'var(--rd-bg-panel)', padding: '4px 8px', borderRadius: 4 }}>
          Loading…
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />
      <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, padding: 8, background: 'var(--rd-bg-panel)', borderRadius: 8, fontSize: '0.75rem', color: 'var(--rd-text-muted)' }}>
        Live map — drivers with shared location. Click marker for name and phone.
      </div>
    </div>
  );
}
