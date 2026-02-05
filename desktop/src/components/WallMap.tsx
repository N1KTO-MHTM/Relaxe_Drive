import { useRef, useEffect, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';

const DEFAULT_CENTER: [number, number] = [41.1112, -74.0438]; // Spring Valley, NY (USA)
const DEFAULT_ZOOM = 10;
const REPORTS_SINCE_MINUTES = 120;

interface Driver {
  id: string;
  nickname: string;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  role: string;
}

interface DriverReport {
  id: string;
  lat: number;
  lng: number;
  type: string;
  description: string | null;
  createdAt: string;
}

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const reportIcon = L.divIcon({
  className: 'wall-map-report-marker',
  html: '<span style="width:14px;height:14px;border-radius:50%;background:#e67e22;border:2px solid #fff;display:block;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export default function WallMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const reportMarkersRef = useRef<L.Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [reports, setReports] = useState<DriverReport[]>([]);

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
      reportMarkersRef.current.forEach((m) => m.remove());
      reportMarkersRef.current = [];
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

  const fetchReports = useCallback((bounds: L.LatLngBounds | null) => {
    const map = mapRef.current;
    if (!map || !bounds) return;
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const minLat = Math.min(ne.lat, sw.lat);
    const maxLat = Math.max(ne.lat, sw.lat);
    const minLng = Math.min(ne.lng, sw.lng);
    const maxLng = Math.max(ne.lng, sw.lng);
    const params = new URLSearchParams({
      minLat: String(minLat),
      maxLat: String(maxLat),
      minLng: String(minLng),
      maxLng: String(maxLng),
      sinceMinutes: String(REPORTS_SINCE_MINUTES),
    });
    api.get<DriverReport[]>(`/reports?${params}`).then((data) => {
      setReports(Array.isArray(data) ? data : []);
    }).catch(() => setReports([]));
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    fetchReports(map.getBounds());
    const onMoveEnd = () => fetchReports(map.getBounds());
    map.on('moveend', onMoveEnd);
    return () => { map.off('moveend', onMoveEnd); };
  }, [fetchReports]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    reportMarkersRef.current.forEach((m) => m.remove());
    reportMarkersRef.current = [];
    reports.forEach((r) => {
      const marker = L.marker([r.lat, r.lng], { icon: reportIcon }).addTo(map);
      const desc = r.description ? ` — ${String(r.description).replace(/</g, '&lt;')}` : '';
      const time = new Date(r.createdAt).toLocaleString();
      marker.bindPopup(`<strong>${String(r.type).replace(/</g, '&lt;')}</strong>${desc}<br/><small>${time}</small>`);
      reportMarkersRef.current.push(marker);
    });
  }, [reports]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 400 }}>
      {loading && (
        <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1000, background: 'var(--rd-bg-panel)', padding: '4px 8px', borderRadius: 4 }}>
          Loading…
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />
      <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, padding: 8, background: 'var(--rd-bg-panel)', borderRadius: 8, fontSize: '0.75rem', color: 'var(--rd-text-muted)' }}>
        Live map — drivers (blue); reports (orange). Click marker for details.
      </div>
    </div>
  );
}
