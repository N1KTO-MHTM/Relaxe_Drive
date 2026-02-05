import { Injectable } from '@nestjs/common';
import { CostTrackerService } from '../cost-tracker/cost-tracker.service';
import { withRetry } from '../common/http-resilience';
import { CircuitBreaker } from '../common/http-resilience';

const OSRM_BASE = process.env.OSRM_URL || 'https://router.project-osrm.org';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'RelaxDrive/1.0 (https://github.com/relaxdrive)';

/** OSRM maneuver type to our step type (0=left, 1=right, 6=straight, 10=arrive, 11=depart, etc.) */
function osrmManeuverToType(maneuver?: string): number {
  if (!maneuver) return 6;
  switch (maneuver) {
    case 'turn': return 6;
    case 'new name': return 6;
    case 'depart': return 11;
    case 'arrive': return 10;
    case 'merge': return 6;
    case 'on ramp': return 1;
    case 'off ramp': return 0;
    case 'fork': return 6;
    case 'end of road': return 6;
    case 'continue': return 6;
    case 'roundabout': return 9;
    case 'rotary': return 9;
    case 'roundabout turn': return 9;
    case 'notification': return 6;
    case 'left': return 0;
    case 'right': return 1;
    case 'sharp left': return 0;
    case 'sharp right': return 1;
    case 'slight left': return 0;
    case 'slight right': return 1;
    default: return 6;
  }
}

export interface RouteStep {
  type: number;
  instruction: string;
  distanceM: number;
  durationS: number;
}

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  polyline: string;
  steps?: RouteStep[];
}

export interface EtaResult {
  minutes: number;
}

/** Routes via OSRM; geocode/reverse via Nominatim (OpenStreetMap). No API keys required. */
@Injectable()
export class GeoService {
  private readonly circuit = new CircuitBreaker(5, 60_000);
  private lastNominatimCall = 0;
  private readonly NOMINATIM_MIN_INTERVAL_MS = 1100;

  constructor(private readonly costTracker: CostTrackerService) {}

  private async throttleNominatim(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastNominatimCall;
    if (elapsed < this.NOMINATIM_MIN_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, this.NOMINATIM_MIN_INTERVAL_MS - elapsed));
    }
    this.lastNominatimCall = Date.now();
  }

  async getRoute(
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
  ): Promise<RouteResult> {
    this.costTracker.increment('maps');
    try {
      return await this.circuit.run(() =>
        withRetry(() => this.fetchRoute(pickup, dropoff), { retries: 3, backoffMs: 500 }),
      );
    } catch (e) {
      console.warn('[GeoService] OSRM getRoute failed:', e);
      return { distanceKm: 0, durationMinutes: 0, polyline: '' };
    }
  }

  private async fetchRoute(
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
  ): Promise<RouteResult> {
    const coords = `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}`;
    const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=polyline&steps=true`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn('[GeoService] OSRM error:', res.status, err);
      throw new Error(`OSRM ${res.status}: ${err}`);
    }
    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: string;
        legs?: Array<{
          steps?: Array<{
            distance?: number;
            duration?: number;
            maneuver?: { type?: string; modifier?: string; location?: number[] };
          }>;
        }>;
      }>;
    };
    if (data.code !== 'Ok') {
      throw new Error(data.code || 'OSRM no route');
    }
    const route = data.routes?.[0];
    const distanceM = route?.distance ?? 0;
    const durationS = route?.duration ?? 0;
    const steps: RouteStep[] = [];
    for (const leg of route?.legs ?? []) {
      for (const s of leg.steps ?? []) {
        const maneuver = s.maneuver;
        const type = osrmManeuverToType(maneuver?.type);
        const instruction = maneuver?.type === 'arrive' ? 'Arrive at destination' : maneuver?.type === 'depart' ? 'Head to destination' : (maneuver?.modifier || maneuver?.type || 'Continue');
        steps.push({
          type,
          instruction,
          distanceM: s.distance ?? 0,
          durationS: s.duration ?? 0,
        });
      }
    }
    return {
      distanceKm: Math.round((distanceM / 1000) * 100) / 100,
      durationMinutes: Math.round((durationS / 60) * 10) / 10,
      polyline: route?.geometry ?? '',
      steps: steps.length > 0 ? steps : undefined,
    };
  }

  async getEta(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<EtaResult> {
    const route = await this.getRoute(from, to);
    return { minutes: route.durationMinutes };
  }

  /** Geocode address to coordinates (Nominatim / OpenStreetMap). Returns null if no result. */
  async geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    if (!address?.trim()) return null;
    this.costTracker.increment('maps');
    await this.throttleNominatim();
    try {
      const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(address.trim())}&format=json&limit=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
      const first = data?.[0];
      if (!first?.lat || !first?.lon) return null;
      const lat = parseFloat(first.lat);
      const lng = parseFloat(first.lon);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    } catch (e) {
      console.warn('[GeoService] Nominatim geocode failed:', e);
      return null;
    }
  }

  /** Reverse geocode: coordinates → address (Nominatim). Returns null if no result. */
  async reverseGeocode(lat: number, lng: number): Promise<{ address: string; layer?: string } | null> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    this.costTracker.increment('maps');
    await this.throttleNominatim();
    try {
      const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { display_name?: string; address?: Record<string, string> };
      const address = data?.display_name ?? null;
      if (!address) return null;
      return { address };
    } catch (e) {
      console.warn('[GeoService] Nominatim reverseGeocode failed:', e);
      return null;
    }
  }
}
