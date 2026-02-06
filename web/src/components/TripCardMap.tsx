import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from './leafletWithCluster';
import { api } from '../api/client';

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

async function fetchCoords(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = address.trim();
  if (!key) return null;
  const cached = geocodeCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const res = await api.get<{ lat: number | null; lng: number | null }>(
      `/geo/geocode?address=${encodeURIComponent(key)}`
    );
    const coords =
      res?.lat != null && res?.lng != null && Number.isFinite(res.lat) && Number.isFinite(res.lng)
        ? { lat: res.lat, lng: res.lng }
        : null;
    geocodeCache.set(key, coords);
    return coords;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}

interface TripCardMapProps {
  pickupAddress: string;
  dropoffAddress: string;
  className?: string;
}

export function TripCardMap({ pickupAddress, dropoffAddress, className }: TripCardMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [coords, setCoords] = useState<{
    pickup: { lat: number; lng: number };
    dropoff: { lat: number; lng: number };
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCoords(pickupAddress), fetchCoords(dropoffAddress)]).then(([pickup, dropoff]) => {
      if (cancelled || !pickup || !dropoff) return;
      setCoords({ pickup, dropoff });
    });
    return () => {
      cancelled = true;
    };
  }, [pickupAddress, dropoffAddress]);

  useEffect(() => {
    if (!coords || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    });
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapRef.current = map;

    const start = L.latLng(coords.pickup.lat, coords.pickup.lng);
    const end = L.latLng(coords.dropoff.lat, coords.dropoff.lng);
    const line = L.polyline([start, end], { color: '#9333ea', weight: 4 }).addTo(map);
    L.marker(start, {
      icon: L.divIcon({
        className: 'trip-card-marker trip-card-marker-start',
        html: '<span class="trip-card-marker-inner">🏁</span>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    }).addTo(map);
    L.marker(end, {
      icon: L.divIcon({
        className: 'trip-card-marker trip-card-marker-end',
        html: '<span class="trip-card-marker-inner trip-card-marker-dot"></span>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(map);

    const bounds = line.getBounds();
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [coords]);

  if (!coords) {
    return (
      <div
        className={className}
        role="img"
        aria-label="Route map loading"
        style={{
          height: 160,
          minHeight: 160,
          background: 'var(--rd-bg-muted, #2a2a2e)',
          borderRadius: 'var(--rd-radius-md, 8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem',
          color: 'var(--rd-text-muted)',
          fontSize: '0.875rem',
        }}
      >
        <span style={{ opacity: 0.8 }}>Route map</span>
        <span>…</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: 160, borderRadius: 'var(--rd-radius-md, 8px)', overflow: 'hidden' }}
    />
  );
}
