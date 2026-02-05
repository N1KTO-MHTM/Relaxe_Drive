import { useRef, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import L from './leafletWithCluster';

const DEFAULT_CENTER: [number, number] = [41.1112, -74.0438]; // Spring Valley, NY
const DEFAULT_ZOOM = 12;

export type DriverMapStatus = 'available' | 'busy' | 'offline';

export interface DriverForMap {
  id: string;
  nickname: string;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** For map: green=available, orange=busy, gray=offline (offline drivers with coords still shown as gray) */
  status?: DriverMapStatus;
}

export interface RouteStep {
  type: number;
  instruction: string;
  distanceM: number;
  durationS: number;
}

export interface OrderRouteData {
  pickupCoords: { lat: number; lng: number } | null;
  dropoffCoords: { lat: number; lng: number } | null;
  polyline: string;
  durationMinutes?: number;
  distanceKm?: number;
  steps?: RouteStep[];
  /** Driver → pickup leg (when driver view) */
  driverToPickupPolyline?: string;
  driverToPickupMinutes?: number;
  driverToPickupSteps?: RouteStep[];
}

interface OrdersMapProps {
  drivers?: DriverForMap[];
  showDriverMarkers?: boolean;
  /** When set, show route and pickup/dropoff markers for this order */
  routeData?: OrderRouteData | null;
  /** Driver's current position (e.g. "You" marker when viewing own route) */
  currentUserLocation?: { lat: number; lng: number } | null;
  /** When set, clicking the map calls this with lat/lng (e.g. pick address from map) */
  onMapClick?: (lat: number, lng: number) => void;
  /** Show a temporary marker at this point (e.g. chosen pickup/dropoff) */
  pickPoint?: { lat: number; lng: number } | null;
  /** Driver nav mode: car at bottom third, map follows route, fast updates */
  navMode?: boolean;
  /** Increment to trigger fitBounds to current route/drivers */
  centerTrigger?: number;
}

/** Decode encoded polyline (OSRM format) into [lat, lng][] */
export function decodePolyline(encoded: string): [number, number][] {
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

// Fix default marker icon in bundler (vite/webpack)
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const DRIVER_COLORS: Record<DriverMapStatus, string> = {
  available: '#22c55e',
  busy: '#f97316',
  offline: '#6b7280',
};

function driverIcon(status: DriverMapStatus): L.DivIcon {
  const color = DRIVER_COLORS[status];
  return L.divIcon({
    className: 'orders-map-driver-marker',
    html: `<span style="background:${color};border:2px solid #fff;border-radius:50%;width:16px;height:16px;display:block;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export default function OrdersMap({ drivers = [], showDriverMarkers = false, routeData, currentUserLocation, onMapClick, pickPoint, navMode = false, centerTrigger = 0 }: OrdersMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const routeLayersRef = useRef<L.Polyline[]>([]);
  const orderMarkersRef = useRef<L.Marker[]>([]);
  const currentUserMarkerRef = useRef<L.Marker | null>(null);
  const pickPointMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;
    const map = L.map(containerRef.current!).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      window.removeEventListener('resize', onResize);
      if (driverClusterRef.current) {
        map.removeLayer(driverClusterRef.current);
        driverClusterRef.current = null;
      }
      if (pickPointMarkerRef.current) {
        map.removeLayer(pickPointMarkerRef.current);
        pickPointMarkerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onMapClick) return;
    const handler = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    };
    map.on('click', handler);
    const container = map.getContainer();
    if (container) container.style.cursor = 'crosshair';
    return () => {
      map.off('click', handler);
      if (container) container.style.cursor = '';
    };
  }, [onMapClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pickPointMarkerRef.current) {
      map.removeLayer(pickPointMarkerRef.current);
      pickPointMarkerRef.current = null;
    }
    if (pickPoint && Number.isFinite(pickPoint.lat) && Number.isFinite(pickPoint.lng)) {
      const m = L.marker([pickPoint.lat, pickPoint.lng]).addTo(map);
      m.bindPopup('Selected');
      pickPointMarkerRef.current = m;
    }
    return () => {
      if (pickPointMarkerRef.current) {
        map.removeLayer(pickPointMarkerRef.current);
        pickPointMarkerRef.current = null;
      }
    };
  }, [pickPoint?.lat, pickPoint?.lng]);

  // Driver markers: status-colored icons + clustering
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (driverClusterRef.current) {
      map.removeLayer(driverClusterRef.current);
      driverClusterRef.current = null;
    }
    if (!showDriverMarkers) return;
    const withCoords = drivers.filter((d) => d.lat != null && d.lng != null && Number.isFinite(d.lat) && Number.isFinite(d.lng));
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
    });
    withCoords.forEach((driver) => {
      const status: DriverMapStatus = driver.status ?? (driver.lat != null && driver.lng != null ? 'available' : 'offline');
      const marker = L.marker([driver.lat!, driver.lng!], { icon: driverIcon(status) });
      const name = driver.nickname || 'Driver';
      const phone = driver.phone ? `<br/><span>${escapeHtml(driver.phone)}</span>` : '';
      marker.bindPopup(`<strong>${escapeHtml(name)}</strong>${phone}`);
      clusterGroup.addLayer(marker);
    });
    clusterGroup.addTo(map);
    driverClusterRef.current = clusterGroup;
    if (withCoords.length > 0) {
      map.invalidateSize();
      map.fitBounds(clusterGroup.getBounds().pad(0.15), { maxZoom: 15 });
    }
    return () => {
      if (driverClusterRef.current) {
        map.removeLayer(driverClusterRef.current);
        driverClusterRef.current = null;
      }
    };
  }, [drivers, showDriverMarkers]);

  // "You" marker for driver view
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (currentUserMarkerRef.current) {
      map.removeLayer(currentUserMarkerRef.current);
      currentUserMarkerRef.current = null;
    }
    if (currentUserLocation && Number.isFinite(currentUserLocation.lat) && Number.isFinite(currentUserLocation.lng)) {
      const m = L.marker([currentUserLocation.lat, currentUserLocation.lng], { icon: defaultIcon }).addTo(map);
      m.bindPopup('You');
      currentUserMarkerRef.current = m;
    }
    return () => {
      if (currentUserMarkerRef.current) {
        map.removeLayer(currentUserMarkerRef.current);
        currentUserMarkerRef.current = null;
      }
    };
  }, [currentUserLocation?.lat, currentUserLocation?.lng]);

  // Route and pickup/dropoff markers; fit map to route (geo update)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeLayersRef.current.forEach((layer) => map.removeLayer(layer));
    routeLayersRef.current = [];
    orderMarkersRef.current.forEach((m) => m.remove());
    orderMarkersRef.current = [];
    if (!routeData) return;
    const { pickupCoords, dropoffCoords, polyline, driverToPickupPolyline } = routeData;
    const allLatLngs: L.LatLng[] = [];
    if (currentUserLocation && Number.isFinite(currentUserLocation.lat) && Number.isFinite(currentUserLocation.lng)) {
      allLatLngs.push(L.latLng(currentUserLocation.lat, currentUserLocation.lng));
    }
    if (showDriverMarkers) {
      drivers.filter((d) => d.lat != null && d.lng != null && Number.isFinite(d.lat) && Number.isFinite(d.lng)).forEach((d) => {
        allLatLngs.push(L.latLng(d.lat!, d.lng!));
      });
    }
    if (pickupCoords) {
      const m = L.marker([pickupCoords.lat, pickupCoords.lng]).addTo(map);
      m.bindPopup('Pickup');
      orderMarkersRef.current.push(m);
      allLatLngs.push(L.latLng(pickupCoords.lat, pickupCoords.lng));
    }
    if (dropoffCoords) {
      const m = L.marker([dropoffCoords.lat, dropoffCoords.lng]).addTo(map);
      m.bindPopup('Dropoff');
      orderMarkersRef.current.push(m);
      allLatLngs.push(L.latLng(dropoffCoords.lat, dropoffCoords.lng));
    }
    // Route style: visible on light map (dark outline + blue main line)
    const routeOutline = { color: '#1e293b', weight: 14, lineCap: 'round' as const, lineJoin: 'round' as const };
    const routeMain = { color: '#2563eb', weight: 8, opacity: 1, lineCap: 'round' as const, lineJoin: 'round' as const };

    if (driverToPickupPolyline && driverToPickupPolyline.length > 0) {
      try {
        const latLngs = decodePolyline(driverToPickupPolyline).map(([lat, lng]) => L.latLng(lat, lng));
        const outline = L.polyline(latLngs, { ...routeOutline, dashArray: '12,10' }).addTo(map);
        const line = L.polyline(latLngs, { ...routeMain, weight: 6, dashArray: '10,8' }).addTo(map);
        routeLayersRef.current.push(outline, line);
        latLngs.forEach((ll) => allLatLngs.push(ll));
      } catch {
        // ignore
      }
    }
    if (polyline && polyline.length > 0) {
      try {
        const latLngs = decodePolyline(polyline).map(([lat, lng]) => L.latLng(lat, lng));
        const outline = L.polyline(latLngs, routeOutline).addTo(map);
        const line = L.polyline(latLngs, routeMain).addTo(map);
        routeLayersRef.current.push(outline, line);
        latLngs.forEach((ll) => allLatLngs.push(ll));
      } catch {
        // ignore
      }
    }
    if (allLatLngs.length > 0 && !navMode) {
      map.invalidateSize();
      const bounds = L.latLngBounds(allLatLngs);
      map.fitBounds(bounds.pad(0.2), { maxZoom: 15 });
    }
    return () => {
      routeLayersRef.current.forEach((layer) => map.removeLayer(layer));
      routeLayersRef.current = [];
      orderMarkersRef.current.forEach((m) => m.remove());
      orderMarkersRef.current = [];
    };
  }, [routeData, currentUserLocation?.lat, currentUserLocation?.lng, showDriverMarkers, drivers, navMode]);

  // centerTrigger: re-fit map to route/drivers when "Center on map" is clicked
  useEffect(() => {
    if (centerTrigger <= 0 || !mapRef.current) return;
    const map = mapRef.current;
    const allLatLngs: L.LatLng[] = [];
    if (currentUserLocation && Number.isFinite(currentUserLocation.lat) && Number.isFinite(currentUserLocation.lng)) {
      allLatLngs.push(L.latLng(currentUserLocation.lat, currentUserLocation.lng));
    }
    if (showDriverMarkers) {
      drivers.filter((d) => d.lat != null && d.lng != null).forEach((d) => allLatLngs.push(L.latLng(d.lat!, d.lng!)));
    }
    if (routeData?.pickupCoords) allLatLngs.push(L.latLng(routeData.pickupCoords.lat, routeData.pickupCoords.lng));
    if (routeData?.dropoffCoords) allLatLngs.push(L.latLng(routeData.dropoffCoords.lat, routeData.dropoffCoords.lng));
    if (allLatLngs.length > 0) {
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(allLatLngs).pad(0.2), { maxZoom: 15 });
    }
  }, [centerTrigger, routeData, currentUserLocation, showDriverMarkers, drivers]);

  // Nav mode: keep car in lower third, center on point ahead on route, update every 2s
  useEffect(() => {
    if (!navMode || !mapRef.current || !currentUserLocation || !routeData) return;
    const map = mapRef.current;
    const encoded = routeData.driverToPickupPolyline || routeData.polyline;
    if (!encoded) return;
    let points: [number, number][];
    try {
      points = decodePolyline(encoded);
    } catch {
      return;
    }
    if (points.length < 2) return;
    const NAV_ZOOM = 17;
    const updateView = () => {
      if (!mapRef.current || !currentUserLocation) return;
      let bestIdx = 0;
      let bestD = 1e9;
      for (let i = 0; i < points.length; i++) {
        const d = (points[i][0] - currentUserLocation.lat) ** 2 + (points[i][1] - currentUserLocation.lng) ** 2;
        if (d < bestD) {
          bestD = d;
          bestIdx = i;
        }
      }
      const aheadIdx = Math.min(bestIdx + 25, points.length - 1);
      const center = points[aheadIdx];
      map.setView([center[0], center[1]], NAV_ZOOM);
    };
    updateView();
    const t = setInterval(updateView, 2000);
    return () => clearInterval(t);
  }, [navMode, currentUserLocation?.lat, currentUserLocation?.lng, routeData?.polyline, routeData?.driverToPickupPolyline]);

  return (
    <div className="orders-map-container" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 480 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 480 }} />
      {!navMode && (
        <div className="orders-map-overlay rd-text-muted" style={{ position: 'absolute', bottom: 8, left: 8, right: 8, padding: 8, background: 'var(--rd-bg-panel)', borderRadius: 8, fontSize: '0.75rem' }}>
          {onMapClick ? 'Click on map to set location. Address will be detected automatically.' : showDriverMarkers ? 'Click driver marker for name and phone.' : 'OpenStreetMap. Orders with coordinates will show as markers.'}
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
