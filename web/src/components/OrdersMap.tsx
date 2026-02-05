import { useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [41.7151, 44.8271]; // Tbilisi
const DEFAULT_ZOOM = 11;

export default function OrdersMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;
    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="orders-map-container" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 400 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />
      <div className="orders-map-overlay rd-text-muted" style={{ position: 'absolute', bottom: 8, left: 8, right: 8, padding: 8, background: 'var(--rd-bg-panel)', borderRadius: 8, fontSize: '0.75rem' }}>
        Live Map — OpenStreetMap. Orders with coordinates will show as markers.
      </div>
    </div>
  );
}
