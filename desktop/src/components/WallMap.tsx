import { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';

const DEFAULT_CENTER: [number, number] = [41.1112, -74.0438]; // Spring Valley, NY (USA)
const DEFAULT_ZOOM = 10;
const REPORTS_SINCE_MINUTES = 120;
const WALL_REFRESH_MS = 5000; // refresh drivers + route every 5s for live geo on map

interface Driver {
  id: string;
  nickname: string;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  role: string;
  available?: boolean;
  carType?: string | null;
  carPlateNumber?: string | null;
  driverId?: string | null;
}

interface DriverReport {
  id: string;
  lat: number;
  lng: number;
  type: string;
  description: string | null;
  createdAt: string;
}

interface Order {
  id: string;
  status: string;
  pickupAt?: string;
  pickupAddress: string;
  dropoffAddress: string;
  driverId?: string | null;
}

interface DriverEta {
  id: string;
  etaMinutesToPickup: number;
  etaMinutesPickupToDropoff: number;
  etaMinutesTotal: number;
}

interface RouteData {
  polyline: string;
  pickupCoords: { lat: number; lng: number } | null;
  dropoffCoords: { lat: number; lng: number } | null;
}

/** Decode OSRM encoded polyline into [lat, lng][] */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 31) << shift;
      shift += 5;
    } while (b >= 32);
    const dlat = (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 31) << shift;
      shift += 5;
    } while (b >= 32);
    const dlng = (result & 1) ? ~(result >> 1) : result >> 1;
    lat += dlat;
    lng += dlng;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
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

/** SVG car icon for driver markers (green = available, red = on trip, gray = offline) */
const CAR_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>';

function driverCarIcon(bgColor: string): L.DivIcon {
  return L.divIcon({
    className: 'wall-map-driver-car',
    html: `<span style="background:${bgColor};border:2px solid #fff;border-radius:10px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.4);">${CAR_ICON_SVG}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export default function WallMap() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const reportMarkersRef = useRef<L.Marker[]>([]);
  const routeLayersRef = useRef<L.Layer[]>([]);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [reports, setReports] = useState<DriverReport[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [driverEtasByOrder, setDriverEtasByOrder] = useState<Record<string, { drivers: DriverEta[] }>>({});
  const [routeData, setRouteData] = useState<RouteData | null>(null);

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
      routeLayersRef.current.forEach((l) => l.remove());
      routeLayersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const loadWallData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<Driver[]>('/users').then((data) => Array.isArray(data) ? data.filter((u: Driver) => u.role === 'DRIVER') : []),
      api.get<Order[]>('/orders').then((data) => Array.isArray(data) ? data : []),
    ]).then(([driverList, orderList]) => {
      setDrivers(driverList);
      setOrders(orderList);
      setLoading(false);
      const active = orderList.filter((o) => o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS');
      const list = active.length ? active : orderList.filter((o) => o.status === 'SCHEDULED');
      const first = list.sort((a, b) => {
        const ta = a.pickupAt ? new Date(a.pickupAt).getTime() : 0;
        const tb = b.pickupAt ? new Date(b.pickupAt).getTime() : 0;
        return ta - tb;
      })[0];
      if (first) {
        api.get<RouteData>(`/orders/${first.id}/route`).then((r) => setRouteData(r)).catch(() => setRouteData(null));
      } else {
        setRouteData(null);
      }
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadWallData();
    const t = setInterval(loadWallData, WALL_REFRESH_MS);
    return () => clearInterval(t);
  }, [loadWallData]);

  // Fetch driver ETAs for active orders so map popups can show ETA
  useEffect(() => {
    const active = orders.filter((o) => o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS');
    const toFetch = active.map((o) => o.id).filter((id) => !driverEtasByOrder[id]);
    if (toFetch.length === 0) return;
    Promise.all(
      toFetch.map((id) =>
        api.get<{ drivers: DriverEta[] }>(`/orders/${id}/driver-etas`).then((data) => ({ id, drivers: data.drivers || [] }))
      )
    ).then((results) => {
      setDriverEtasByOrder((prev) => {
        const next = { ...prev };
        results.forEach(({ id, drivers }) => { next[id] = { drivers }; });
        return next;
      });
    }).catch(() => {});
  }, [orders, driverEtasByOrder]);

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
      const onTripOrder = orders.find((o) => o.driverId === driver.id && (o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS'));
      const onTrip = !!onTripOrder;
      const available = driver.available !== false;
      const bgColor = onTrip ? '#ef4444' : (available ? '#22c55e' : '#6b7280');
      const etaData = onTripOrder && driverEtasByOrder[onTripOrder.id]?.drivers?.find((x) => x.id === driver.id);
      const marker = L.marker([driver.lat!, driver.lng!], { icon: driverCarIcon(bgColor) }).addTo(map);
      const esc = (s: string) => String(s).replace(/</g, '&lt;').replace(/"/g, '&quot;');
      const name = driver.nickname || 'Driver';
      const rows: string[] = [`<strong>${esc(name)}</strong>`];
      if (driver.phone) rows.push(`${t('clients.phone')}: ${esc(driver.phone)}`);
      if (driver.driverId) rows.push(`${t('drivers.driverId')}: ${esc(driver.driverId)}`);
      if (driver.carType) rows.push(`${t('auth.carType')}: ${esc(driver.carType)}`);
      if (driver.carPlateNumber) rows.push(`${t('auth.carPlateNumber')}: ${esc(driver.carPlateNumber)}`);
      const statusLabel = onTrip ? t('dashboard.onTrip') : (available ? t('dashboard.available') : t('dashboard.offline'));
      rows.push(`${t('drivers.status')}: ${esc(statusLabel)}`);
      if (onTripOrder && (onTripOrder.pickupAddress || onTripOrder.dropoffAddress)) {
        const pickup = (onTripOrder.pickupAddress ?? '').trim() || '—';
        const dropoff = (onTripOrder.dropoffAddress ?? '').trim() || '—';
        rows.push(`${esc(t('dashboard.currentTrip'))}: ${esc(pickup)} → ${esc(dropoff)}`);
      }
      if (etaData && Number.isFinite(etaData.etaMinutesToPickup)) {
        rows.push(`${esc(t('dashboard.etaToPickup'))}: ${etaData.etaMinutesToPickup} min`);
      }
      if (etaData && Number.isFinite(etaData.etaMinutesTotal)) {
        rows.push(`${esc(t('dashboard.etaTotal'))}: ${etaData.etaMinutesTotal} min`);
      }
      marker.bindPopup(rows.join('<br/>'));
      markersRef.current.push(marker);
    });
  }, [drivers, orders, driverEtasByOrder, t]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeLayersRef.current.forEach((l) => l.remove());
    routeLayersRef.current = [];
    if (routeData?.polyline && routeData.polyline.length > 0) {
      const latLngs = decodePolyline(routeData.polyline).map(([lat, lng]) => L.latLng(lat, lng));
      const line = L.polyline(latLngs, { color: '#3b82f6', weight: 6, opacity: 0.9 }).addTo(map);
      routeLayersRef.current.push(line);
    }
    if (routeData?.pickupCoords) {
      const m = L.marker([routeData.pickupCoords.lat, routeData.pickupCoords.lng], { icon: defaultIcon }).addTo(map);
      m.bindPopup('<strong>Pickup</strong>');
      routeLayersRef.current.push(m);
    }
    if (routeData?.dropoffCoords) {
      const m = L.marker([routeData.dropoffCoords.lat, routeData.dropoffCoords.lng], { icon: defaultIcon }).addTo(map);
      m.bindPopup('<strong>Dropoff</strong>');
      routeLayersRef.current.push(m);
    }
  }, [routeData]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 400 }}>
      {loading && (
        <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1000, background: 'var(--rd-bg-panel)', padding: '4px 8px', borderRadius: 4 }}>
          {t('common.loading')}
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />
      <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, padding: 8, background: 'var(--rd-bg-panel)', borderRadius: 8, fontSize: '0.75rem', color: 'var(--rd-text-muted)' }}>
        One map: drivers (blue markers), active route (blue line), pickup/dropoff. Refreshes every 10s.
      </div>
    </div>
  );
}
