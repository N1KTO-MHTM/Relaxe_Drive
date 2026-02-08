import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';
import L from './leafletWithCluster';
import { api } from '../api/client';
import { decodePolyline } from './OrdersMap';

interface AddressRouteMapProps {
  pickupAddress: string;
  dropoffAddress: string;
  className?: string;
  height?: number;
}

export function AddressRouteMap({ pickupAddress, dropoffAddress, className, height }: AddressRouteMapProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [routeData, setRouteData] = useState<{
    polyline: string;
    pickupCoords: { lat: number; lng: number };
    dropoffCoords: { lat: number; lng: number };
    durationMinutes: number;
    distanceKm: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const o = pickupAddress?.trim();
    const d = dropoffAddress?.trim();
    if (!o || !d) {
      setRouteData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<{ polyline?: string; pickupCoords?: { lat: number; lng: number }; dropoffCoords?: { lat: number; lng: number }; durationMinutes?: number; distanceKm?: number }>(
        `/geo/route?origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}`
      )
      .then((res) => {
        if (cancelled || !res?.pickupCoords || !res?.dropoffCoords) return;
        setRouteData({
          polyline: res.polyline ?? '',
          pickupCoords: res.pickupCoords,
          dropoffCoords: res.dropoffCoords,
          durationMinutes: res.durationMinutes ?? 0,
          distanceKm: res.distanceKm ?? 0,
        });
      })
      .catch(() => setRouteData(null))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pickupAddress, dropoffAddress]);

  useEffect(() => {
    if (!routeData || !containerRef.current) return;
    const el = containerRef.current;
    const map = L.map(el, { zoomControl: false, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapRef.current = map;

    const start = L.latLng(routeData.pickupCoords.lat, routeData.pickupCoords.lng);
    const end = L.latLng(routeData.dropoffCoords.lat, routeData.dropoffCoords.lng);

    L.marker(start, {
      icon: L.divIcon({
        className: 'address-route-marker address-route-marker-start',
        html: '<span class="address-route-marker-inner">🏁</span>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    }).addTo(map);
    L.marker(end, {
      icon: L.divIcon({
        className: 'address-route-marker address-route-marker-end',
        html: '<span class="address-route-marker-inner address-route-marker-dot"></span>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(map);

    const allLatLngs: L.LatLng[] = [start, end];
    if (routeData.polyline) {
      try {
        const latLngs = decodePolyline(routeData.polyline).map(([lat, lng]) => L.latLng(lat, lng));
        L.polyline(latLngs, { color: '#2563eb', weight: 5, opacity: 0.8 }).addTo(map);
        latLngs.forEach((ll) => allLatLngs.push(ll));
      } catch {
        L.polyline([start, end], { color: '#2563eb', weight: 5, opacity: 0.8 }).addTo(map);
      }
    } else {
      L.polyline([start, end], { color: '#2563eb', weight: 5, opacity: 0.8 }).addTo(map);
    }
    const bounds = L.latLngBounds(allLatLngs);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });

    const invalidate = () => map.invalidateSize();
    const ro = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          invalidate();
          [100, 400, 800, 2000, 4000].forEach((ms) => setTimeout(invalidate, ms));
        }
      },
      { threshold: 0.05 }
    );
    ro.observe(el);
    const resizeObs = new ResizeObserver(() => {
      invalidate();
      setTimeout(invalidate, 100);
    });
    resizeObs.observe(el);
    [100, 400, 1000, 2000, 4000].forEach((ms) => setTimeout(invalidate, ms));

    return () => {
      ro.disconnect();
      resizeObs.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [routeData]);

  if (!pickupAddress?.trim() || !dropoffAddress?.trim()) {
    return (
      <div className={className} style={{ width: '100%', minHeight: 200, background: 'var(--rd-bg-muted)', borderRadius: 'var(--rd-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rd-text-muted)' }}>
        {t('dashboard.addressesMapHint')}
      </div>
    );
  }
  if (loading || !routeData) {
    return (
      <div className={className} style={{ width: '100%', minHeight: 200, background: 'var(--rd-bg-muted)', borderRadius: 'var(--rd-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rd-text-muted)' }}>
        {loading ? 'Loading route…' : 'Route not found'}
      </div>
    );
  }
  return (
    <div className={className} style={{ width: '100%', minHeight: height || 200, borderRadius: 'var(--rd-radius)', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: height || 220 }} aria-label="Route map" />
      <p className="rd-text-muted" style={{ marginTop: '0.35rem', fontSize: '0.875rem' }}>
        ~{routeData.durationMinutes} min · {routeData.distanceKm} km
      </p>
    </div>
  );
}
