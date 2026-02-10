import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from './leafletWithCluster';
import { api } from '../api/client';

const GEOCODE_CACHE_MAX = 80;
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

function pruneGeocodeCache(): void {
  if (geocodeCache.size <= GEOCODE_CACHE_MAX) return;
  const keysToDelete = [...geocodeCache.keys()].slice(0, geocodeCache.size - GEOCODE_CACHE_MAX);
  keysToDelete.forEach((k) => geocodeCache.delete(k));
}

const NOMINATIM_UA = 'RelaxeDrive/1.0 (Trip history map)';

/** Geocode via backend first; if null, try Nominatim from client so trip history map still shows. */
async function fetchCoords(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = address.trim();
  if (!key) return null;
  const cached = geocodeCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const res = await api.get<{ lat: number | null; lng: number | null }>(
      `/geo/geocode?address=${encodeURIComponent(key)}`
    );
    let coords: { lat: number; lng: number } | null =
      res?.lat != null && res?.lng != null && Number.isFinite(res.lat) && Number.isFinite(res.lng)
        ? { lat: res.lat, lng: res.lng }
        : null;
    if (!coords) {
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(key)}&format=json&limit=1`;
        const nomRes = await fetch(nomUrl, { headers: { 'User-Agent': NOMINATIM_UA } });
        if (nomRes.ok) {
          const data = (await nomRes.json()) as Array<{ lat?: string; lon?: string }>;
          const first = data?.[0];
          if (first?.lat && first?.lon) {
            const lat = parseFloat(first.lat);
            const lng = parseFloat(first.lon);
            if (Number.isFinite(lat) && Number.isFinite(lng)) coords = { lat, lng };
          }
        }
      } catch {
        // keep coords null
      }
    }
    geocodeCache.set(key, coords);
    pruneGeocodeCache();
    return coords;
  } catch {
    geocodeCache.set(key, null);
    pruneGeocodeCache();
    return null;
  }
}

interface TripCardMapProps {
  pickupAddress: string;
  dropoffAddress: string;
  className?: string;
  polyline?: string | null;
}

export function TripCardMap({ pickupAddress, dropoffAddress, className, polyline }: TripCardMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [coords, setCoords] = useState<{
    pickup: { lat: number; lng: number };
    dropoff: { lat: number; lng: number };
  } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
    let cancelled = false;
    Promise.all([fetchCoords(pickupAddress), fetchCoords(dropoffAddress)]).then(([pickup, dropoff]) => {
      if (cancelled) return;
      if (pickup && dropoff) {
        setCoords({ pickup, dropoff });
      } else {
        setLoadFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pickupAddress, dropoffAddress]);

  useEffect(() => {
    if (!coords || !containerRef.current) return;
    const el = containerRef.current;
    const map = L.map(el, {
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
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

    const invalidate = () => map.invalidateSize();
    requestAnimationFrame(() => {
      invalidate();
      setTimeout(invalidate, 50);
    });
    const ro = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          invalidate();
          [100, 400, 800, 2000, 4000].forEach((ms) => setTimeout(invalidate, ms));
        }
      },
      { threshold: 0.05 },
    );
    ro.observe(el);
    const timeouts: number[] = [100, 400, 1000, 2000, 3000, 5000].map((ms) => window.setTimeout(invalidate, ms));
    const resizeObs = new ResizeObserver(() => {
      invalidate();
      setTimeout(invalidate, 100);
    });
    resizeObs.observe(el);
    return () => {
      ro.disconnect();
      resizeObs.disconnect();
      timeouts.forEach((id) => clearTimeout(id));
      map.remove();
      mapRef.current = null;
    };
  }, [coords]);

  // Handle polyline if provided
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !polyline) return;

    // Decode polyline logic (copied from OrdersMap to avoid circular dep or move to utils)
    const points: [number, number][] = [];
    let index = 0, lat = 0, lng = 0;
    while (index < polyline.length) {
      let b, shift = 0, result = 0;
      do { b = polyline.charCodeAt(index++) - 63; result |= (b & 31) << shift; shift += 5; } while (b >= 32);
      lat += ((result & 1) ? ~(result >> 1) : result >> 1);
      shift = 0; result = 0;
      do { b = polyline.charCodeAt(index++) - 63; result |= (b & 31) << shift; shift += 5; } while (b >= 32);
      lng += ((result & 1) ? ~(result >> 1) : result >> 1);
      points.push([lat / 1e5, lng / 1e5]);
    }

    const line = L.polyline(points, { color: '#9333ea', weight: 4 }).addTo(map);
    const bounds = line.getBounds();
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });

    return () => { map.removeLayer(line); };
  }, [polyline, coords]); // Re-run if coords change (map re-init) or polyline changes

  if (!coords) {
    return (
      <div
        className={className}
        role="img"
        aria-label={loadFailed ? 'Route map unavailable' : 'Route map loading'}
        style={{
          width: '100%',
          minWidth: 200,
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
        {loadFailed ? (
          <span style={{ opacity: 0.9 }}>Map unavailable</span>
        ) : (
          <>
            <span style={{ opacity: 0.8 }}>Route map</span>
            <span>…</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        minWidth: 200,
        height: 160,
        minHeight: 160,
        borderRadius: 'var(--rd-radius-md, 8px)',
        overflow: 'hidden',
        background: 'var(--rd-bg-muted, #2a2a2e)',
      }}
    />
  );
}
