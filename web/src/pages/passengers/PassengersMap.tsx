import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';
import L from '../../components/leafletWithCluster';
import { api } from '../../api/client';
import type { PassengerRow } from '../../types';

const GEOCODE_CACHE_MAX = 80;
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

function pruneGeocodeCache(): void {
  if (geocodeCache.size <= GEOCODE_CACHE_MAX) return;
  const keysToDelete = [...geocodeCache.keys()].slice(0, geocodeCache.size - GEOCODE_CACHE_MAX);
  keysToDelete.forEach((k) => geocodeCache.delete(k));
}

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
    pruneGeocodeCache();
    return coords;
  } catch {
    geocodeCache.set(key, null);
    pruneGeocodeCache();
    return null;
  }
}

interface MapPoint {
  lat: number;
  lng: number;
  address: string;
  /** Clients who have this address as pickup */
  pickups: PassengerRow[];
  /** Clients who have this address as dropoff */
  dropoffs: PassengerRow[];
}

interface PassengersMapProps {
  clients: PassengerRow[];
  className?: string;
}

export function PassengersMap({ clients, className }: PassengersMapProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const addresses = new Set<string>();
    clients.forEach((c) => {
      if (c.pickupAddr?.trim()) addresses.add(c.pickupAddr.trim());
      if (c.dropoffAddr?.trim()) addresses.add(c.dropoffAddr.trim());
    });
    const addrList = Array.from(addresses);
    if (addrList.length === 0) {
      setPoints([]);
      setLoading(false);
      return;
    }
    Promise.all(addrList.map((addr) => fetchCoords(addr))).then((results) => {
      if (cancelled) return;
      const byAddr = new Map<string, MapPoint>();
      addrList.forEach((addr, i) => {
        const coords = results[i];
        if (!coords) return;
        const key = addr;
        const pickups = clients.filter((c) => (c.pickupAddr ?? '').trim() === addr);
        const dropoffs = clients.filter((c) => (c.dropoffAddr ?? '').trim() === addr);
        if (pickups.length > 0 || dropoffs.length > 0) {
          byAddr.set(key, {
            lat: coords.lat,
            lng: coords.lng,
            address: addr,
            pickups,
            dropoffs,
          });
        }
      });
      setPoints(Array.from(byAddr.values()));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [clients]);

  useEffect(() => {
    if (points.length === 0 || !containerRef.current) return;
    const el = containerRef.current;
    el.style.minHeight = '320px';
    const map = L.map(el, {
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapRef.current = map;

    const invalidate = () => map.invalidateSize();
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
    const resizeObs = new ResizeObserver(() => {
      invalidate();
      setTimeout(invalidate, 100);
    });
    resizeObs.observe(el);

    const bounds = new L.LatLngBounds([]);
    const esc = (s: string) => String(s).replace(/</g, '&lt;').replace(/"/g, '&quot;');
    points.forEach((pt) => {
      const latLng = L.latLng(pt.lat, pt.lng);
      bounds.extend(latLng);
      const parts: string[] = [];
      if (pt.pickups.length > 0) {
        parts.push(`<strong>${t('passengers.pickup')}</strong> — ${esc(pt.address)}`);
        pt.pickups.forEach((c) => {
          parts.push(`<div class="passengers-map-popup-row">📞 ${esc(c.phone ?? '—')}${(c.name ?? '').trim() ? ` — ${esc(c.name ?? '')}` : ''}</div>`);
        });
      }
      if (pt.dropoffs.length > 0) {
        parts.push(`<strong>${t('passengers.dropoff')}</strong> — ${esc(pt.address)}`);
        pt.dropoffs.forEach((c) => {
          parts.push(`<div class="passengers-map-popup-row">📞 ${esc(c.phone ?? '—')}${(c.name ?? '').trim() ? ` — ${esc(c.name ?? '')}` : ''}</div>`);
        });
      }
      const marker = L.marker(latLng, {
        icon: L.divIcon({
          className: 'passengers-map-marker',
          html: '<span class="passengers-map-marker-pin" aria-hidden="true">📍</span>',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        }),
      }).addTo(map);
      marker.bindPopup(
        `<div class="passengers-map-popup">${parts.join('<br/>')}</div>`,
        { maxWidth: 320 },
      );
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
    }
    const timeouts: number[] = [];
    [100, 400, 1000, 2000, 3000, 5000].forEach((ms) => timeouts.push(window.setTimeout(() => map.invalidateSize(), ms)));
    return () => {
      ro.disconnect();
      resizeObs.disconnect();
      timeouts.forEach((id) => clearTimeout(id));
      map.remove();
      mapRef.current = null;
    };
  }, [points, t]);

  if (loading) {
    return (
      <div
        className={className}
        style={{
          width: '100%',
          height: 320,
          background: 'var(--rd-bg-muted, #2a2a2e)',
          borderRadius: 'var(--rd-radius-md, 8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--rd-text-muted)',
          fontSize: '0.875rem',
        }}
      >
        {t('common.loading')}
      </div>
    );
  }

  if (points.length === 0) {
    const hasAddresses = clients.some((c) => (c.pickupAddr ?? '').trim() || (c.dropoffAddr ?? '').trim());
    return (
      <div
        className={className}
        style={{
          width: '100%',
          minHeight: 240,
          height: 240,
          background: 'var(--rd-bg-muted, #2a2a2e)',
          borderRadius: 'var(--rd-radius-md, 8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--rd-text-muted)',
          fontSize: '0.875rem',
          padding: '1rem',
          textAlign: 'center',
        }}
      >
        {hasAddresses ? t('passengers.geocodingOrNoCoords') : t('passengers.noAddressesOnMap')}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
style={{
          width: '100%',
          height: 320,
          minHeight: 280,
          borderRadius: 'var(--rd-radius-md, 8px)',
          overflow: 'hidden',
          background: 'var(--rd-bg-muted, #2a2a2e)',
        }}
    />
  );
}
