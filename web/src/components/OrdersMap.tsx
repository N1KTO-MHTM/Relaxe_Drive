import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';
import L from './leafletWithCluster';
import { DriverForMap, DriverMapStatus, OrderRouteData } from '../types';

const DEFAULT_CENTER: [number, number] = [41.1112, -74.0438]; // Spring Valley, NY
const DEFAULT_ZOOM = 12;

export type DriverReportMap = {
  id: string;
  lat: number;
  lng: number;
  type: string;
  description?: string | null;
  createdAt?: string;
};

interface OrdersMapProps {
  drivers?: DriverForMap[];
  showDriverMarkers?: boolean;
  routeData?: OrderRouteData | null;
  currentUserLocation?: { lat: number; lng: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
  pickPoint?: { lat: number; lng: number } | null;
  navMode?: boolean;
  centerTrigger?: number;
  reports?: DriverReportMap[];
  /** When alternative routes exist, 0 = main, 1 = first alternative, etc. */
  selectedRouteIndex?: number;
  /** Called when user clicks Re-center (e.g. to fit map to route + location) */
  onRecenter?: () => void;
  recenterLabel?: string;
  /** Risk level of the selected order: colors pickup marker green/yellow/red */
  orderRiskLevel?: string | null;
  /** Tooltip for selected order pickup: ETA, on-time, driver */
  selectedOrderTooltip?: { eta?: string; onTime?: boolean; driverName?: string };
  /** Future orders for overlay: semi-transparent pickup markers (exclude selected) */
  futureOrderPickups?: { orderId: string; lat: number; lng: number; pickupAt: string }[];
  /** Problem zones for heatmap: late pickups and cancelled (from GET /planning/problem-zones) */
  problemZones?: {
    late: { lat: number; lng: number }[];
    cancelled: { lat: number; lng: number }[];
  };
  /** When set, Re-center / centerTrigger will move map to this point (e.g. search by geo or driver location) */
  focusCenter?: { lat: number; lng: number } | null;
  /** Optional "My location" button label and callback to center map on user's geo */
  myLocationLabel?: string;
  onMyLocation?: () => void;
  /** Restore saved map view (e.g. per-dispatcher). Applied only on first init. */
  initialCenter?: [number, number];
  initialZoom?: number;
  /** Called on moveend so parent can persist view (e.g. per-dispatcher map). */
  onMapViewChange?: (center: [number, number], zoom: number) => void;
  /** Driver's "You" marker style: car or arrow (only when currentUserLocation is set). */
  driverMarkerStyle?: 'car' | 'arrow';
  /** Current speed in mph (shown near driver marker). */
  currentUserSpeedMph?: number | null;
  /** When set, driver is standing; show "here for X min". */
  currentUserStandingStartedAt?: number | null;
  /** Short label where driver is heading (e.g. "To pickup", "To dropoff"). */
  currentUserHeadingTo?: string | null;
  /** Heading in degrees (0–360) to rotate driver icon in direction of movement. */
  currentUserHeadingDegrees?: number | null;
  /** When true (driver view): only show reports, route line and my location; no pickup/dropoff markers. */
  driverView?: boolean;
  /** Zones to display (polygons) */
  zones?: Array<{
    id: string;
    name: string;
    color: string;
    points: Array<{ lat: number; lng: number }>;
  }>;
  /** Whether to show the zones on the map */
  showZones?: boolean;
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
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 31) << shift;
      shift += 5;
    } while (b >= 32);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
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

/** SVG car icon (top-down) for consistent look across devices */
const CAR_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>';

/** SVG arrow (pointing up) for driver "You" marker */
const ARROW_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="22" height="22"><path d="M12 2L4 14h5v8h6v-8h5L12 2z"/></svg>';

/** "You" marker: blue car icon, optional rotation (degrees) for heading. */
function currentUserCarIcon(rotationDegrees?: number): L.DivIcon {
  const transform =
    rotationDegrees != null && Number.isFinite(rotationDegrees)
      ? `transform:rotate(${rotationDegrees}deg);transform-origin:center center;`
      : '';
  const svg = CAR_ICON_SVG.replace('width="18" height="18"', 'width="32" height="32"')
    .replace('fill="white"', 'fill="#2563eb"')
    .replace('<svg', `<svg style="${transform}"`);
  return L.divIcon({
    className: 'orders-map-current-user-marker',
    html: `<span style="display:flex;align-items:center;justify-content:center;" title="You">${svg}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

/** "You" marker: blue arrow icon (pointing up), optional rotation for heading. */
function currentUserArrowIcon(rotationDegrees?: number): L.DivIcon {
  const transform =
    rotationDegrees != null && Number.isFinite(rotationDegrees)
      ? `transform:rotate(${rotationDegrees}deg);transform-origin:center center;`
      : '';
  const svg = ARROW_ICON_SVG.replace('width="22" height="22"', 'width="32" height="32"')
    .replace('fill="white"', 'fill="#2563eb"')
    .replace('<svg', `<svg style="${transform}"`);
  return L.divIcon({
    className: 'orders-map-current-user-marker',
    html: `<span style="display:flex;align-items:center;justify-content:center;" title="You">${svg}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const REPORT_COLORS: Record<string, string> = {
  POLICE: '#3b82f6',
  TRAFFIC: '#f59e0b',
  WORK_ZONE: '#eab308',
  CAR_CRASH: '#ef4444',
  OTHER: '#6b7280',
};

const REPORT_TYPE_KEYS: Record<string, string> = {
  POLICE: 'dashboard.reportPolice',
  TRAFFIC: 'dashboard.reportTraffic',
  WORK_ZONE: 'dashboard.reportWorkZone',
  CAR_CRASH: 'dashboard.reportCrash',
  OTHER: 'dashboard.reportOther',
};

/** Emoji per report type for clearer map icons. */
const REPORT_EMOJI: Record<string, string> = {
  POLICE: '👮',
  TRAFFIC: '🛑',
  WORK_ZONE: '🚧',
  CAR_CRASH: '💥',
  OTHER: '⚠️',
};

function reportIcon(type: string): L.DivIcon {
  const color = REPORT_COLORS[type] || REPORT_COLORS.OTHER;
  const emoji = REPORT_EMOJI[type] || REPORT_EMOJI.OTHER;
  return L.divIcon({
    className: 'orders-map-report-marker',
    html: `<span style="background:${color};color:#fff;border:2px solid #fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;box-shadow:0 2px 6px rgba(0,0,0,0.45);">${emoji}</span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

const ORDER_RISK_COLORS: Record<string, string> = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#ef4444',
};

function orderPickupIcon(riskLevel: string | null | undefined): L.DivIcon {
  const color = (riskLevel && ORDER_RISK_COLORS[riskLevel]) || ORDER_RISK_COLORS.LOW;
  return L.divIcon({
    className: 'orders-map-order-marker',
    html: `<span style="background:${color};border:2px solid #fff;border-radius:50%;width:28px;height:28px;display:inline-block;box-shadow:0 2px 6px rgba(0,0,0,0.35);" title="Pickup"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

declare global {
  interface Window {
    L: typeof L & {
      heatLayer?: (
        latlngs: [number, number, number][],
        options?: { radius?: number; blur?: number; gradient?: Record<number, string> },
      ) => L.Layer;
    };
  }
}

const SMOOTH_MOVE_MS = 1000;
export default function OrdersMap({
  drivers = [],
  showDriverMarkers = false,
  routeData,
  currentUserLocation,
  onMapClick,
  pickPoint,
  navMode = false,
  centerTrigger = 0,
  reports = [],
  selectedRouteIndex = 0,
  onRecenter,
  recenterLabel = 'Re-center',
  orderRiskLevel,
  selectedOrderTooltip,
  futureOrderPickups = [],
  problemZones,
  zones = [],
  showZones = true,
  focusCenter,
  initialCenter,
  initialZoom,
  onMapViewChange,
  driverMarkerStyle = 'car',
  currentUserSpeedMph,
  currentUserStandingStartedAt,
  currentUserHeadingTo,
  currentUserHeadingDegrees,
  driverView = false,
  myLocationLabel,
  onMyLocation,
}: OrdersMapProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const routeLayersRef = useRef<L.Polyline[]>([]);
  const orderMarkersRef = useRef<L.Marker[]>([]);
  const futureMarkersRef = useRef<L.Marker[]>([]);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const reportMarkersRef = useRef<L.Marker[]>([]);
  const currentUserMarkerRef = useRef<L.Marker | null>(null);
  const pickPointMarkerRef = useRef<L.Marker | null>(null);
  const serviceAreaRef = useRef<L.Polygon | null>(null);
  /** Driver path trail (where current user drove) — last N points. */
  const driverPathTrailRef = useRef<[number, number][]>([]);
  const driverPathLayerRef = useRef<L.Polyline | null>(null);
  /** Per-driver markers for smooth position updates (no teleport). */
  const driverMarkersByIdRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;
    const el = containerRef.current;
    const startCenter =
      initialCenter &&
      initialCenter.length === 2 &&
      Number.isFinite(initialCenter[0]) &&
      Number.isFinite(initialCenter[1])
        ? (initialCenter as [number, number])
        : DEFAULT_CENTER;
    const startZoom =
      typeof initialZoom === 'number' && Number.isFinite(initialZoom) ? initialZoom : DEFAULT_ZOOM;
    const map = L.map(el).setView(startCenter, startZoom);
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    });
    tileLayer.addTo(map);

    // Traffic layer removed (not implemented)

    mapRef.current = map;
    let handleMoveEnd: (() => void) | undefined;
    if (onMapViewChange) {
      handleMoveEnd = () => {
        const c = map.getCenter();
        onMapViewChange([c.lat, c.lng], map.getZoom());
      };
      map.on('moveend', handleMoveEnd);
      map.on('zoomend', handleMoveEnd);
    }
    const onPopupExitClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest?.('.orders-map-popup-close')) map.closePopup();
    };
    map.getContainer().addEventListener('click', onPopupExitClick);
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    const timeouts: number[] = [];
    [100, 400, 1000].forEach((ms) =>
      timeouts.push(
        window.setTimeout(() => {
          map.invalidateSize();
        }, ms),
      ),
    );
    return () => {
      timeouts.forEach((id) => clearTimeout(id));
      if (handleMoveEnd) {
        map.off('moveend', handleMoveEnd);
        map.off('zoomend', handleMoveEnd);
      }
      map.getContainer().removeEventListener('click', onPopupExitClick);
      window.removeEventListener('resize', onResize);
      if (serviceAreaRef.current) {
        map.removeLayer(serviceAreaRef.current);
        serviceAreaRef.current = null;
      }
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
      m.bindPopup('Selected', { closeOnClick: false });
      pickPointMarkerRef.current = m;
    }
    return () => {
      if (pickPointMarkerRef.current) {
        map.removeLayer(pickPointMarkerRef.current);
        pickPointMarkerRef.current = null;
      }
    };
  }, [pickPoint?.lat, pickPoint?.lng]);

  // Create or remove driver cluster when showDriverMarkers toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!showDriverMarkers) {
      if (driverClusterRef.current) {
        map.removeLayer(driverClusterRef.current);
        driverClusterRef.current = null;
      }
      driverMarkersByIdRef.current.forEach((m) => m.remove());
      driverMarkersByIdRef.current.clear();
      return;
    }
    if (driverClusterRef.current) return;

    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<span class="orders-map-driver-cluster__count">${count}</span>`,
          className: 'orders-map-driver-cluster',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });
      },
    });
    clusterGroup.addTo(map);
    driverClusterRef.current = clusterGroup;
    return () => {
      if (driverClusterRef.current) {
        map.removeLayer(driverClusterRef.current);
        driverClusterRef.current = null;
      }
      driverMarkersByIdRef.current.clear();
    };
  }, [showDriverMarkers]);

  // Driver markers: add/update/remove by id so positions update smoothly (no teleport)
  useEffect(() => {
    const map = mapRef.current;
    const cluster = driverClusterRef.current;
    if (!map || !cluster || !showDriverMarkers) return;
    const withCoords = drivers.filter(
      (d) => d.lat != null && d.lng != null && Number.isFinite(d.lat) && Number.isFinite(d.lng),
    );
    const ids = new Set(withCoords.map((d) => d.id));

    withCoords.forEach((driver) => {
      const status: DriverMapStatus = driver.status ?? 'available';
      const lat = driver.lat!;
      const lng = driver.lng!;
      let marker = driverMarkersByIdRef.current.get(driver.id);

      const icon = driverIcon(driver);

      if (marker) {
        const prev = marker.getLatLng();
        const distM = Math.sqrt((lat - prev.lat) ** 2 + (lng - prev.lng) ** 2) * 111320;

        // Update icon (for status/color/rotation changes)
        // Note: L.Marker setIcon might flicker if not careful, but divIcon with inner HTML transition should be okay
        const currentIcon = marker.getIcon() as L.DivIcon;
        if (currentIcon.options.html !== icon.options.html) {
          marker.setIcon(icon);
        }

        if (distM > 500) {
          // Teleport if distance > 500m (approx 30s at 60mph)
          marker.setLatLng([lat, lng]);
        } else if (distM > 2) {
          const startTime = performance.now();
          const startLat = prev.lat,
            startLng = prev.lng;
          const animate = () => {
            const t = Math.min((performance.now() - startTime) / SMOOTH_MOVE_MS, 1);
            const eased = t < 1 ? 1 - (1 - t) * (1 - t) : 1;
            marker!.setLatLng(
              L.latLng(startLat + (lat - startLat) * eased, startLng + (lng - startLng) * eased),
            );
            if (t < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      } else {
        marker = L.marker([lat, lng], { icon }); // Use initial icon with rotation 0
        const name = driver.nickname || 'Driver';

        let contentHtml = `
          <div style="font-family: inherit; color: #f3f4f6; min-width: 200px;">
            <div style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem; color: #fff; border-bottom: 1px solid #374151; padding-bottom: 0.5rem;">
              ${escapeHtml(name)}
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.875rem;">
        `;

        if (driver.phone) {
          contentHtml += `
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #9ca3af;">Phone:</span>
              <a href="tel:${escapeHtml(driver.phone)}" style="color: #60a5fa; text-decoration: none;">${escapeHtml(driver.phone)}</a>
            </div>`;
        }
        if (driver.driverId) {
          contentHtml += `
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #9ca3af;">${escapeHtml(t('drivers.driverId'))}:</span>
              <span>${escapeHtml(driver.driverId)}</span>
            </div>`;
        }
        if (driver.carId) {
          contentHtml += `
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #9ca3af;">${escapeHtml(t('drivers.carId'))}:</span>
              <span>${escapeHtml(driver.carId)}</span>
            </div>`;
        }
        if (driver.carType) {
          contentHtml += `
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #9ca3af;">Car:</span>
              <span>${escapeHtml(driver.carType)}</span>
            </div>`;
        }
        if (driver.carPlateNumber) {
          contentHtml += `
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #9ca3af;">Plate:</span>
              <span>${escapeHtml(driver.carPlateNumber)}</span>
            </div>`;
        }

        const statusLabel =
          driver.statusLabel ??
          (status === 'busy' ? 'On trip' : status === 'available' ? 'Available' : 'Offline');
        const statusColor =
          status === 'available' ? '#4ade80' : status === 'busy' ? '#f87171' : '#9ca3af';
        contentHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem;">
              <span style="color: #9ca3af;">Status:</span>
              <span style="color: ${statusColor}; font-weight: 500;">${escapeHtml(statusLabel)}</span>
            </div>`;

        if (driver.assignedOrderPickup != null || driver.assignedOrderDropoff != null) {
          const pickup = (driver.assignedOrderPickup ?? '').trim() || '—';
          const dropoff = (driver.assignedOrderDropoff ?? '').trim() || '—';
          contentHtml += `
            <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #374151;">
              <div style="color: #9ca3af; font-size: 0.75rem; margin-bottom: 0.1rem;">${escapeHtml(t('dashboard.currentTrip'))}</div>
              <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;" title="${escapeHtml(pickup)} → ${escapeHtml(dropoff)}">
                ${escapeHtml(pickup)}<br/>↓<br/>${escapeHtml(dropoff)}
              </div>
            </div>`;
        }

        if (driver.etaMinutesToPickup != null && Number.isFinite(driver.etaMinutesToPickup)) {
          contentHtml += `<div style="color: #fbbf24; font-size: 0.8125rem; margin-top: 0.25rem;">${escapeHtml(t('dashboard.etaToPickup'))}: ${driver.etaMinutesToPickup} min</div>`;
        }

        contentHtml += `</div>`; // Close details div

        const exitLabel = escapeHtml(t('common.close'));
        contentHtml += `
          <button type="button" class="orders-map-popup-close" style="
            margin-top: 1rem; width: 100%; padding: 0.5rem; 
            background-color: #2563eb; color: white; border: none; border-radius: 0.375rem; 
            font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='#1d4ed8'" onmouseout="this.style.backgroundColor='#2563eb'">
            ${exitLabel}
          </button>
          </div>
        `;

        marker.bindPopup(contentHtml, {
          closeOnClick: false,
          autoClose: false,
          className: 'orders-map-dark-popup',
        });
        cluster.addLayer(marker);
        driverMarkersByIdRef.current.set(driver.id, marker);
      }
    });

    driverMarkersByIdRef.current.forEach((marker, id) => {
      if (!ids.has(id)) {
        cluster.removeLayer(marker);
        driverMarkersByIdRef.current.delete(id);
      }
    });
  }, [drivers, showDriverMarkers, t]);

  // Helper function to create driver icons
  const driverIcon = (d: DriverForMap) => {
    const isBusy = d.status === 'busy';
    const isOffline = d.status === 'offline';
    const statusClass = isBusy ? 'filter-busy' : isOffline ? 'filter-offline' : 'filter-available';

    // Construct the label content:
    let infoLabel = '';
    if (isBusy && (d.currentOrderDistance || d.assignedOrderDropoff || d.assignedOrderPickup)) {
      const dest = d.assignedOrderDropoff
        ? d.assignedOrderDropoff.split(',')[0]
        : d.assignedOrderPickup
          ? d.assignedOrderPickup.split(',')[0]
          : '';
      const dist = d.currentOrderDistance ? `(${d.currentOrderDistance})` : '';
      if (dest || dist) {
        infoLabel = `<div class="driver-marker-info" style="
            position: absolute;
            bottom: -20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            white-space: nowrap;
            z-index: 1000;
          ">${dest} ${dist}</div>`;
      }
    }

    return L.divIcon({
      className: 'driver-marker-icon',
      html: `
      <div class="driver-marker-wrapper ${statusClass}" style="position: relative;">
         <div class="driver-marker-car">
            <img src="/marker-car.png" alt="Car" />
         </div>
         ${infoLabel}
      </div>
    `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  };

  // Future order pickups overlay (semi-transparent); skip in driver view
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    futureMarkersRef.current.forEach((m) => m.remove());
    futureMarkersRef.current = [];
    if (driverView) return;
    futureOrderPickups.forEach((f) => {
      const icon = L.divIcon({
        className: 'orders-map-future-marker',
        html: `<span style="background:rgba(79,114,158,0.5);border:2px solid rgba(255,255,255,0.8);border-radius:50%;width:22px;height:22px;display:inline-block;box-shadow:0 1px 4px rgba(0,0,0,0.3);" title="Future pickup"></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const m = L.marker([f.lat, f.lng], { icon }).addTo(map);
      try {
        const t = new Date(f.pickupAt);
        m.bindPopup(`Future pickup ${t.toLocaleTimeString()}`, { closeOnClick: false });
      } catch {
        m.bindPopup('Future pickup', { closeOnClick: false });
      }
      futureMarkersRef.current.push(m);
    });
    return () => {
      futureMarkersRef.current.forEach((m) => m.remove());
      futureMarkersRef.current = [];
    };
  }, [futureOrderPickups, driverView]);

  // Problem zones heatmap (late pickups + cancels); skip in driver view
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !problemZones || driverView) return;
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    const late = problemZones.late ?? [];
    const cancelled = problemZones.cancelled ?? [];
    const points: [number, number, number][] = [];
    late.forEach((p) => points.push([p.lat, p.lng, 0.8]));
    cancelled.forEach((p) => points.push([p.lat, p.lng, 0.5]));
    if (points.length === 0) return;
    const winL =
      typeof window !== 'undefined'
        ? (
            window as unknown as {
              L?: typeof L & {
                heatLayer?: (latlngs: [number, number, number][], o?: object) => L.Layer;
              };
            }
          ).L
        : null;
    const HeatLayer =
      winL?.heatLayer ??
      (L as unknown as { heatLayer?: (latlngs: [number, number, number][], o?: object) => L.Layer })
        .heatLayer;
    if (HeatLayer) {
      const layer = HeatLayer(points, { radius: 32, blur: 22, minOpacity: 0.35 });
      layer.addTo(map);
      heatLayerRef.current = layer;
    } else {
      const circleGroup = L.layerGroup();
      late.forEach((p) => {
        L.circle([p.lat, p.lng], {
          radius: 400,
          color: '#f59e0b',
          fillColor: '#f59e0b',
          fillOpacity: 0.35,
          weight: 2,
        }).addTo(circleGroup);
      });
      cancelled.forEach((p) => {
        L.circle([p.lat, p.lng], {
          radius: 350,
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.3,
          weight: 2,
        }).addTo(circleGroup);
      });
      circleGroup.addTo(map);
      heatLayerRef.current = circleGroup;
    }
    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [problemZones, driverView]);

  // Zones overlay
  const zonesLayerRef = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (zonesLayerRef.current) {
      map.removeLayer(zonesLayerRef.current);
      zonesLayerRef.current = null;
    }
    if (!showZones || !zones || zones.length === 0 || driverView) return;

    const group = L.layerGroup().addTo(map);
    zones.forEach((z) => {
      try {
        const poly = L.polygon(z.points, {
          color: z.color || '#2dd4bf', // Default teal if missing
          weight: 1,
          fill: true,
          fillColor: z.color || '#2dd4bf',
          fillOpacity: 0.2, // Transparent as requested
          interactive: true,
        }).addTo(group);
        poly.bindTooltip(z.name, {
          permanent: true,
          direction: 'center',
          className: 'rd-zone-label',
          opacity: 0.7,
        });
        poly.bindPopup(`<strong>${escapeHtml(z.name)}</strong>`, { closeOnClick: false });
      } catch (e) {
        console.error('Failed to render zone', z, e);
      }
    });
    zonesLayerRef.current = group;
    return () => {
      if (zonesLayerRef.current) {
        map.removeLayer(zonesLayerRef.current);
        zonesLayerRef.current = null;
      }
    };
  }, [zones, driverView, showZones]);

  // "You" marker for driver view: create once, then smooth-move on location change
  const currentUserTargetRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (
      !currentUserLocation ||
      !Number.isFinite(currentUserLocation.lat) ||
      !Number.isFinite(currentUserLocation.lng)
    ) {
      if (currentUserMarkerRef.current) {
        map.removeLayer(currentUserMarkerRef.current);
        currentUserMarkerRef.current = null;
      }
      currentUserTargetRef.current = null;
      return;
    }
    const target = { lat: currentUserLocation.lat, lng: currentUserLocation.lng };
    if (!currentUserMarkerRef.current) {
      const icon =
        driverMarkerStyle === 'arrow'
          ? currentUserArrowIcon(currentUserHeadingDegrees ?? undefined)
          : currentUserCarIcon(currentUserHeadingDegrees ?? undefined);
      const m = L.marker([target.lat, target.lng], { icon }).addTo(map);
      const popupLines = ['You'];
      if (currentUserStandingStartedAt != null) {
        const min = Math.floor((Date.now() - currentUserStandingStartedAt) / 60000);
        popupLines.push(`here for ${min} min`);
      } else if (currentUserSpeedMph != null && Number.isFinite(currentUserSpeedMph)) {
        popupLines.push(`${Math.round(currentUserSpeedMph)} mph`);
      }
      if (currentUserHeadingTo) popupLines.push(currentUserHeadingTo);
      m.bindPopup(popupLines.join(' · '), { closeOnClick: false });
      currentUserMarkerRef.current = m;
      currentUserTargetRef.current = target;
      return () => {
        if (currentUserMarkerRef.current) {
          map.removeLayer(currentUserMarkerRef.current);
          currentUserMarkerRef.current = null;
        }
        currentUserTargetRef.current = null;
      };
    }
    currentUserMarkerRef.current.setIcon(
      driverMarkerStyle === 'arrow'
        ? currentUserArrowIcon(currentUserHeadingDegrees ?? undefined)
        : currentUserCarIcon(currentUserHeadingDegrees ?? undefined),
    );
    currentUserTargetRef.current = target;
  }, [
    driverMarkerStyle,
    currentUserLocation?.lat,
    currentUserLocation?.lng,
    currentUserHeadingDegrees,
  ]);

  // Smooth animate marker to new position when location updates (instant if jump is large)
  useEffect(() => {
    const map = mapRef.current;
    const marker = currentUserMarkerRef.current;
    if (
      !map ||
      !marker ||
      !currentUserLocation ||
      !Number.isFinite(currentUserLocation.lat) ||
      !Number.isFinite(currentUserLocation.lng)
    )
      return;
    const start = marker.getLatLng();
    const end = L.latLng(currentUserLocation.lat, currentUserLocation.lng);
    const distM = Math.sqrt((end.lat - start.lat) ** 2 + (end.lng - start.lng) ** 2) * 111320;
    if (distM > 80) {
      marker.setLatLng(end);
      return;
    }
    const startTime = performance.now();
    let rafId: number;
    const tick = () => {
      const t = Math.min((performance.now() - startTime) / SMOOTH_MOVE_MS, 1);
      const eased = t < 1 ? 1 - (1 - t) * (1 - t) : 1;
      const lat = start.lat + (end.lat - start.lat) * eased;
      const lng = start.lng + (end.lng - start.lng) * eased;
      marker.setLatLng(L.latLng(lat, lng));
      if (t < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [currentUserLocation?.lat, currentUserLocation?.lng]);

  // Driver path trail: line showing where the current user (driver) has driven
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (
      !currentUserLocation ||
      !Number.isFinite(currentUserLocation.lat) ||
      !Number.isFinite(currentUserLocation.lng)
    ) {
      if (driverPathLayerRef.current) {
        map.removeLayer(driverPathLayerRef.current);
        driverPathLayerRef.current = null;
      }
      driverPathTrailRef.current = [];
      return;
    }
    const trail = driverPathTrailRef.current;
    trail.push([currentUserLocation.lat, currentUserLocation.lng]);
    if (trail.length > 50) trail.shift();
    if (driverPathLayerRef.current) map.removeLayer(driverPathLayerRef.current);
    if (trail.length < 2) return;
    const latLngs = trail.map(([lat, lng]) => L.latLng(lat, lng));
    const line = L.polyline(latLngs, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.7,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    driverPathLayerRef.current = line;
    return () => {
      if (driverPathLayerRef.current) {
        map.removeLayer(driverPathLayerRef.current);
        driverPathLayerRef.current = null;
      }
    };
  }, [currentUserLocation?.lat, currentUserLocation?.lng]);

  // Update popup when speed, standing, or heading changes (tick when standing so "here for X min" updates)
  const [standingTick, setStandingTick] = useState(0);
  useEffect(() => {
    if (currentUserStandingStartedAt == null) return;
    const id = setInterval(() => setStandingTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [currentUserStandingStartedAt]);
  useEffect(() => {
    const marker = currentUserMarkerRef.current;
    if (!marker) return;
    const popupLines = ['You'];
    if (currentUserStandingStartedAt != null) {
      const min = Math.floor((Date.now() - currentUserStandingStartedAt) / 60000);
      popupLines.push(`here for ${min} min`);
    } else if (currentUserSpeedMph != null && Number.isFinite(currentUserSpeedMph)) {
      popupLines.push(`${Math.round(currentUserSpeedMph)} mph`);
    }
    if (currentUserHeadingTo) popupLines.push(currentUserHeadingTo);
    const content = popupLines.join(' · ');
    if (marker.getPopup()?.getContent() !== content) marker.getPopup()?.setContent(content);
  }, [currentUserSpeedMph, currentUserStandingStartedAt, currentUserHeadingTo, standingTick]);

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
    if (
      currentUserLocation &&
      Number.isFinite(currentUserLocation.lat) &&
      Number.isFinite(currentUserLocation.lng)
    ) {
      allLatLngs.push(L.latLng(currentUserLocation.lat, currentUserLocation.lng));
    }
    if (showDriverMarkers) {
      drivers
        .filter(
          (d) => d.lat != null && d.lng != null && Number.isFinite(d.lat) && Number.isFinite(d.lng),
        )
        .forEach((d) => {
          allLatLngs.push(L.latLng(d.lat!, d.lng!));
        });
    }
    if (!driverView) {
      if (pickupCoords) {
        const m = L.marker([pickupCoords.lat, pickupCoords.lng], {
          icon: orderPickupIcon(orderRiskLevel),
        }).addTo(map);
        const popupRows: string[] = ['<strong>Pickup</strong>'];
        if (selectedOrderTooltip) {
          if (selectedOrderTooltip.eta)
            popupRows.push(`ETA: ${escapeHtml(selectedOrderTooltip.eta)}`);
          popupRows.push(selectedOrderTooltip.onTime ? 'On time' : 'At risk / Late');
          if (selectedOrderTooltip.driverName)
            popupRows.push(`Driver: ${escapeHtml(selectedOrderTooltip.driverName)}`);
        }
        m.bindPopup(popupRows.join('<br/>'), { closeOnClick: false });
        orderMarkersRef.current.push(m);
        allLatLngs.push(L.latLng(pickupCoords.lat, pickupCoords.lng));
      }
      if (dropoffCoords) {
        const m = L.marker([dropoffCoords.lat, dropoffCoords.lng]).addTo(map);
        m.bindPopup('Dropoff', { closeOnClick: false });
        orderMarkersRef.current.push(m);
        allLatLngs.push(L.latLng(dropoffCoords.lat, dropoffCoords.lng));
      }
    } else if (pickupCoords) {
      allLatLngs.push(L.latLng(pickupCoords.lat, pickupCoords.lng));
    } else if (dropoffCoords) {
      allLatLngs.push(L.latLng(dropoffCoords.lat, dropoffCoords.lng));
    }
    // Route style: more visible roads (thicker outline + brighter main line)
    const routeOutline = {
      color: '#0f172a',
      weight: 20,
      lineCap: 'round' as const,
      lineJoin: 'round' as const,
    };
    const routeMain = {
      color: '#3b82f6',
      weight: 12,
      opacity: 1,
      lineCap: 'round' as const,
      lineJoin: 'round' as const,
    };

    if (driverToPickupPolyline && driverToPickupPolyline.length > 0) {
      try {
        const latLngs = decodePolyline(driverToPickupPolyline).map(([lat, lng]) =>
          L.latLng(lat, lng),
        );
        const outline = L.polyline(latLngs, { ...routeOutline, dashArray: '14,12' }).addTo(map);
        const line = L.polyline(latLngs, { ...routeMain, weight: 8, dashArray: '12,10' }).addTo(
          map,
        );
        routeLayersRef.current.push(outline, line);
        latLngs.forEach((ll) => allLatLngs.push(ll));
      } catch {
        // ignore
      }
    }
    const altRoutes = routeData.alternativeRoutes ?? [];
    const effectivePolyline =
      altRoutes.length > 0 && selectedRouteIndex > 0 && altRoutes[selectedRouteIndex - 1]
        ? altRoutes[selectedRouteIndex - 1].polyline
        : polyline;
    if (effectivePolyline && effectivePolyline.length > 0) {
      try {
        const latLngs = decodePolyline(effectivePolyline).map(([lat, lng]) => L.latLng(lat, lng));
        const outline = L.polyline(latLngs, routeOutline).addTo(map);
        const line = L.polyline(latLngs, routeMain).addTo(map);
        routeLayersRef.current.push(outline, line);
        latLngs.forEach((ll) => allLatLngs.push(ll));
      } catch {
        // ignore
      }
    }
    altRoutes.forEach((alt, i) => {
      if (alt.polyline && alt.polyline.length > 0 && i !== selectedRouteIndex - 1) {
        try {
          const latLngs = decodePolyline(alt.polyline).map(([lat, lng]) => L.latLng(lat, lng));
          const gray = L.polyline(latLngs, {
            color: '#64748b',
            weight: 5,
            opacity: 0.7,
            dashArray: '8,8',
          }).addTo(map);
          routeLayersRef.current.push(gray);
        } catch {
          // ignore
        }
      }
    });
    if (allLatLngs.length > 0) {
      map.invalidateSize();
      // Do not auto-fit when route/order changes: user can click Re-center to fit. Stops map jumping for dispatcher.
    }
    return () => {
      routeLayersRef.current.forEach((layer) => map.removeLayer(layer));
      routeLayersRef.current = [];
      orderMarkersRef.current.forEach((m) => m.remove());
      orderMarkersRef.current = [];
    };
  }, [
    routeData,
    currentUserLocation?.lat,
    currentUserLocation?.lng,
    showDriverMarkers,
    drivers,
    navMode,
    selectedRouteIndex,
    orderRiskLevel,
    selectedOrderTooltip,
    driverView,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    reportMarkersRef.current.forEach((m) => m.remove());
    reportMarkersRef.current = [];
    if (reports.length === 0) return;
    reports.forEach((r) => {
      const m = L.marker([r.lat, r.lng], { icon: reportIcon(r.type) }).addTo(map);
      const typeLabel = t(REPORT_TYPE_KEYS[r.type] || 'dashboard.reportOther');
      const emoji = REPORT_EMOJI[r.type] || REPORT_EMOJI.OTHER;
      const ageSec = r.createdAt
        ? Math.max(0, Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 1000))
        : 0;
      const ageStr = ageSec < 60 ? `${ageSec}s ago` : `${Math.floor(ageSec / 60)}m ago`;
      const desc = r.description?.trim() ? escapeHtml(r.description) : '';
      const content = `<div class="orders-map-report-popup" data-report-id="${escapeHtml(r.id)}"><span style="font-size:1.25em">${emoji}</span> <strong>${escapeHtml(typeLabel)}</strong><br><span class="rd-text-muted">${ageStr}</span>${desc ? `<br><span class="rd-text-muted">${desc}</span>` : ''}</div>`;
      m.bindPopup(content, { closeOnClick: false, autoClose: true, closeButton: true });
      reportMarkersRef.current.push(m);
    });
    return () => {
      reportMarkersRef.current.forEach((m) => m.remove());
      reportMarkersRef.current = [];
    };
  }, [reports, t]);

  // Re-fit map only when user clicks Re-center (centerTrigger). Do NOT re-run when drivers/route
  // update — that would make the dispatcher map follow driver movements; dispatcher map is independent.
  useEffect(() => {
    if (centerTrigger <= 0 || !mapRef.current) return;
    const map = mapRef.current;
    if (focusCenter && Number.isFinite(focusCenter.lat) && Number.isFinite(focusCenter.lng)) {
      map.invalidateSize();
      map.setView([focusCenter.lat, focusCenter.lng], 14);
      return;
    }
    const allLatLngs: L.LatLng[] = [];
    if (
      currentUserLocation &&
      Number.isFinite(currentUserLocation.lat) &&
      Number.isFinite(currentUserLocation.lng)
    ) {
      allLatLngs.push(L.latLng(currentUserLocation.lat, currentUserLocation.lng));
    }
    if (showDriverMarkers) {
      drivers
        .filter((d) => d.lat != null && d.lng != null)
        .forEach((d) => allLatLngs.push(L.latLng(d.lat!, d.lng!)));
    }
    if (routeData?.pickupCoords)
      allLatLngs.push(L.latLng(routeData.pickupCoords.lat, routeData.pickupCoords.lng));
    if (routeData?.dropoffCoords)
      allLatLngs.push(L.latLng(routeData.dropoffCoords.lat, routeData.dropoffCoords.lng));
    if (allLatLngs.length > 0) {
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(allLatLngs).pad(0.2), { maxZoom: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-center on button click (centerTrigger), not when drivers/route update
  }, [centerTrigger, focusCenter?.lat, focusCenter?.lng]);

  // Nav mode: map follows the driver (center on car when moving). Updates every 1s so map tracks driver.
  useEffect(() => {
    if (!navMode || !mapRef.current || !currentUserLocation) return;
    const map = mapRef.current;
    const NAV_ZOOM = 17;
    const followDriver = () => {
      if (!mapRef.current || !currentUserLocation) return;
      map.setView([currentUserLocation.lat, currentUserLocation.lng], NAV_ZOOM);
    };
    followDriver();
    const t = setInterval(followDriver, 1000);
    return () => clearInterval(t);
  }, [navMode, currentUserLocation?.lat, currentUserLocation?.lng]);

  const handlePickOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onMapClick || !mapRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const map = mapRef.current;
    const rect = map.getContainer().getBoundingClientRect();
    const point = L.point(e.clientX - rect.left, e.clientY - rect.top);
    const latlng = map.containerPointToLatLng(point);
    onMapClick(latlng.lat, latlng.lng);
  };

  return (
    <div
      className="orders-map-container"
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 480 }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 480 }} />

      {onMapClick && !navMode && (
        <div
          className="orders-map-pick-overlay"
          role="button"
          tabIndex={0}
          onClick={handlePickOverlayClick}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLDivElement).click()}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 500,
            cursor: 'crosshair',
            background: 'rgba(0,0,0,0.02)',
          }}
          title="Click anywhere to set location"
        />
      )}
      {((onRecenter && (navMode || showDriverMarkers || routeData)) || onMyLocation) && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            zIndex: 1000,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {onMyLocation && myLocationLabel && (
            <button
              type="button"
              className="rd-btn orders-map-recenter"
              onClick={onMyLocation}
              aria-label={myLocationLabel}
            >
              {myLocationLabel}
            </button>
          )}
          {onRecenter && (navMode || showDriverMarkers || routeData) && (
            <button
              type="button"
              className="rd-btn orders-map-recenter"
              onClick={onRecenter}
              aria-label={recenterLabel}
            >
              {recenterLabel}
            </button>
          )}
        </div>
      )}
      {!navMode && (
        <div
          className="orders-map-overlay rd-text-muted"
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            right: 8,
            padding: 8,
            background: 'var(--rd-bg-panel)',
            borderRadius: 8,
            fontSize: '0.75rem',
            zIndex: 501,
            pointerEvents: onMapClick ? 'none' : undefined,
          }}
        >
          {onMapClick
            ? t('dashboard.mapHintClick')
            : showDriverMarkers
              ? t('dashboard.mapHintDriver')
              : t('dashboard.mapHintOrders')}
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
