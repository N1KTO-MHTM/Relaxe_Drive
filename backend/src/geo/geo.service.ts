import { Injectable } from '@nestjs/common';
import { CostTrackerService } from '../cost-tracker/cost-tracker.service';
import { withRetry } from '../common/http-resilience';
import { CircuitBreaker } from '../common/http-resilience';

const OSRM_BASE = process.env.OSRM_URL || 'https://router.project-osrm.org';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'RelaxDrive/1.0 (https://github.com/relaxdrive)';
const GOOGLE_MAPS_API_KEY = (process.env.GOOGLE_MAPS_API_KEY ?? '').trim();
const MAPBOX_API_KEY = (process.env.MAPBOX_API_KEY ?? '').trim();
const TOMTOM_API_KEY = (process.env.TOMTOM_API_KEY ?? '').trim();
const OPENWEATHER_API_KEY = (process.env.OPENWEATHER_API_KEY ?? '').trim();

/** Strip HTML tags for Google step instructions. */
function stripHtml(html?: string): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, '').trim() || '';
}

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
  trafficLevel?: 'low' | 'moderate' | 'heavy';
  trafficDelayMinutes?: number;
  hasTolls?: boolean;
  tollCount?: number;
  summary?: string; // e.g., "via I-95 N"
  weather?: {
    condition: string; // e.g., "Clear", "Rain", "Snow"
    temp: number; // Celsius
    icon: string; // weather icon code
  };
  incidents?: Array<{
    type: 'accident' | 'construction' | 'closure' | 'congestion';
    description: string;
    severity: 'low' | 'moderate' | 'high';
    distanceFromStart?: number; // km
  }>;
  trafficSegments?: Array<{
    startKm: number;
    endKm: number;
    speed: number; // km/h
    congestion: 'low' | 'moderate' | 'heavy';
  }>;
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

  constructor(private readonly costTracker: CostTrackerService) { }

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
    if (GOOGLE_MAPS_API_KEY) {
      try {
        const r = await this.fetchRouteGoogle([pickup, dropoff], { departureTime: 'now' });
        if (r.polyline) return r;
      } catch (e) {
        console.warn('[GeoService] Google getRoute failed, falling back to OSRM:', e);
      }
    }
    try {
      const r = await this.circuit.run(() =>
        withRetry(() => this.fetchRoute(pickup, dropoff, false), { retries: 3, backoffMs: 500 }),
      );
      return Array.isArray(r) ? r[0] : r;
    } catch (e) {
      console.warn('[GeoService] OSRM getRoute failed:', e);
      return { distanceKm: 0, durationMinutes: 0, polyline: '' };
    }
  }

  /** Route through multiple points in order: A → B → C → … (e.g. pickup → stop1 → stop2 → dropoff). */
  async getRouteMulti(points: Array<{ lat: number; lng: number }>): Promise<RouteResult> {
    if (points.length < 2) return { distanceKm: 0, durationMinutes: 0, polyline: '' };
    this.costTracker.increment('maps');
    if (GOOGLE_MAPS_API_KEY) {
      try {
        const r = await this.fetchRouteGoogle(points, { departureTime: 'now' });
        if (r.polyline) return r;
      } catch (e) {
        console.warn('[GeoService] Google getRouteMulti failed, falling back to OSRM:', e);
      }
    }
    try {
      const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
      const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=polyline&steps=true`;
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) {
        const err = await res.text();
        console.warn('[GeoService] OSRM getRouteMulti error:', res.status, err);
        return { distanceKm: 0, durationMinutes: 0, polyline: '' };
      }
      const data = (await res.json()) as { code?: string; routes?: Array<{ distance?: number; duration?: number; geometry?: string; legs?: Array<{ steps?: Array<{ distance?: number; duration?: number; maneuver?: { type?: string; modifier?: string } }> }> }> };
      if (data.code !== 'Ok' || !data.routes?.[0]) return { distanceKm: 0, durationMinutes: 0, polyline: '' };
      const route = data.routes[0];
      const distanceM = route.distance ?? 0;
      const durationS = route.duration ?? 0;
      const steps: RouteStep[] = [];
      for (const leg of route.legs ?? []) {
        for (const s of leg.steps ?? []) {
          const maneuver = s.maneuver;
          steps.push({
            type: osrmManeuverToType(maneuver?.type),
            instruction: maneuver?.type === 'arrive' ? 'Arrive' : maneuver?.type === 'depart' ? 'Head to next' : (maneuver?.modifier || 'Continue'),
            distanceM: s.distance ?? 0,
            durationS: s.duration ?? 0,
          });
        }
      }
      return {
        distanceKm: Math.round((distanceM / 1000) * 100) / 100,
        durationMinutes: Math.round((durationS / 60) * 10) / 10,
        polyline: route.geometry ?? '',
        steps: steps.length > 0 ? steps : undefined,
      };
    } catch (e) {
      console.warn('[GeoService] OSRM getRouteMulti failed:', e);
      return { distanceKm: 0, durationMinutes: 0, polyline: '' };
    }
  }

  /** Request multiple route alternatives (when OSRM server supports it). Returns at least one. */
  async getRouteAlternatives(
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
    maxAlternatives = 3,
  ): Promise<RouteResult[]> {
    this.costTracker.increment('maps');
    if (GOOGLE_MAPS_API_KEY) {
      try {
        const routes = await this.fetchRouteAlternativesGoogle(pickup, dropoff, maxAlternatives);
        if (routes.length > 0) return routes;
      } catch (e) {
        console.warn('[GeoService] Google getRouteAlternatives failed, falling back to OSRM:', e);
      }
    }
    try {
      const result = await this.circuit.run(() =>
        withRetry(() => this.fetchRoute(pickup, dropoff, true, maxAlternatives), { retries: 3, backoffMs: 500 }),
      );
      return Array.isArray(result) ? result : [result];
    } catch (e) {
      console.warn('[GeoService] OSRM getRouteAlternatives failed:', e);
      return [{ distanceKm: 0, durationMinutes: 0, polyline: '' }];
    }
  }

  /** Google Directions API: single route through points. Returns same format as OSRM for use on our map. */
  private async fetchRouteGoogle(
    points: Array<{ lat: number; lng: number }>,
    options?: { departureTime?: 'now' },
  ): Promise<RouteResult> {
    const origin = `${points[0].lat},${points[0].lng}`;
    const destination = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;
    const waypoints =
      points.length > 2
        ? '&waypoints=' + points.slice(1, -1).map((p) => `${p.lat},${p.lng}`).join('|')
        : '';
    const departure = options?.departureTime === 'now' ? '&departure_time=now' : '';
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypoints}&mode=driving${departure}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`Google Directions ${res.status}`);
    const data = (await res.json()) as {
      status?: string;
      routes?: Array<{
        overview_polyline?: { points?: string };
        summary?: string;
        legs?: Array<{
          duration?: { value?: number };
          duration_in_traffic?: { value?: number };
          distance?: { value?: number };
          steps?: Array<{ duration?: { value?: number }; distance?: { value?: number }; maneuver?: string; html_instructions?: string }>;
        }>;
      }>;
    };
    if (data.status !== 'OK' || !data.routes?.[0]) throw new Error(data.status || 'No route');
    const route = data.routes[0];
    const polyline = route.overview_polyline?.points ?? '';
    const summary = route.summary;
    let distanceM = 0;
    let durationS = 0;
    let durationInTrafficS = 0;
    let hasTolls = false;
    const steps: RouteStep[] = [];
    for (const leg of route.legs ?? []) {
      distanceM += leg.distance?.value ?? 0;
      const legDuration = leg.duration?.value ?? 0;
      const legTrafficDuration = leg.duration_in_traffic?.value ?? legDuration;
      durationS += legDuration;
      durationInTrafficS += legTrafficDuration;
      for (const s of leg.steps ?? []) {
        const instr = stripHtml(s.html_instructions) || 'Continue';
        // Detect tolls from instructions
        if (instr.toLowerCase().includes('toll') || instr.toLowerCase().includes('turnpike')) {
          hasTolls = true;
        }
        steps.push({
          type: 6,
          instruction: instr,
          distanceM: s.distance?.value ?? 0,
          durationS: s.duration?.value ?? 0,
        });
      }
    }
    // Calculate traffic delay and level
    const trafficDelayMinutes = Math.max(0, Math.round((durationInTrafficS - durationS) / 60));
    let trafficLevel: 'low' | 'moderate' | 'heavy' | undefined;
    if (trafficDelayMinutes === 0) {
      trafficLevel = 'low';
    } else if (trafficDelayMinutes < 5) {
      trafficLevel = 'moderate';
    } else {
      trafficLevel = 'heavy';
    }
    return {
      distanceKm: Math.round((distanceM / 1000) * 100) / 100,
      durationMinutes: Math.round((durationInTrafficS / 60) * 10) / 10,
      polyline,
      steps: steps.length > 0 ? steps : undefined,
      trafficLevel,
      trafficDelayMinutes: trafficDelayMinutes > 0 ? trafficDelayMinutes : undefined,
      hasTolls: hasTolls || undefined,
      summary,
    };
  }

  /** Google Directions with alternatives (multiple routes). */
  private async fetchRouteAlternativesGoogle(
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
    maxAlternatives: number,
  ): Promise<RouteResult[]> {
    const origin = `${pickup.lat},${pickup.lng}`;
    const destination = `${dropoff.lat},${dropoff.lng}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving&alternatives=true&departure_time=now&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`Google Directions ${res.status}`);
    const data = (await res.json()) as {
      status?: string;
      routes?: Array<{
        overview_polyline?: { points?: string };
        summary?: string;
        legs?: Array<{
          duration?: { value?: number };
          duration_in_traffic?: { value?: number };
          distance?: { value?: number };
          steps?: Array<{ duration?: { value?: number }; distance?: { value?: number }; html_instructions?: string }>;
        }>;
      }>;
    };
    if (data.status !== 'OK' || !data.routes?.length) return [];
    const results: RouteResult[] = [];
    for (const route of data.routes.slice(0, maxAlternatives + 1)) {
      const polyline = route.overview_polyline?.points ?? '';
      const summary = route.summary;
      let distanceM = 0;
      let durationS = 0;
      let durationInTrafficS = 0;
      let hasTolls = false;
      let tollCount = 0;
      for (const leg of route.legs ?? []) {
        distanceM += leg.distance?.value ?? 0;
        const legDuration = leg.duration?.value ?? 0;
        const legTrafficDuration = leg.duration_in_traffic?.value ?? legDuration;
        durationS += legDuration;
        durationInTrafficS += legTrafficDuration;
        // Check for tolls in steps
        for (const s of leg.steps ?? []) {
          const instr = stripHtml(s.html_instructions) || '';
          if (instr.toLowerCase().includes('toll') || instr.toLowerCase().includes('turnpike')) {
            hasTolls = true;
            tollCount++;
          }
        }
      }
      // Calculate traffic delay and level
      const trafficDelayMinutes = Math.max(0, Math.round((durationInTrafficS - durationS) / 60));
      let trafficLevel: 'low' | 'moderate' | 'heavy' | undefined;
      if (trafficDelayMinutes === 0) {
        trafficLevel = 'low';
      } else if (trafficDelayMinutes < 5) {
        trafficLevel = 'moderate';
      } else {
        trafficLevel = 'heavy';
      }
      results.push({
        distanceKm: Math.round((distanceM / 1000) * 100) / 100,
        durationMinutes: Math.round((durationInTrafficS / 60) * 10) / 10,
        polyline,
        trafficLevel,
        trafficDelayMinutes: trafficDelayMinutes > 0 ? trafficDelayMinutes : undefined,
        hasTolls: hasTolls || undefined,
        tollCount: tollCount > 0 ? tollCount : undefined,
        summary,
      });
    }
    return results;
  }

  private async fetchRoute(
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
    alternatives: boolean,
    maxAlternatives = 3,
  ): Promise<RouteResult | RouteResult[]> {
    const coords = `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}`;
    const altParam = alternatives ? `&alternatives=true&number=${Math.min(maxAlternatives, 3)}` : '';
    const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=polyline&steps=true${altParam}`;
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
    const routes = data.routes ?? [];
    const toResult = (route: (typeof routes)[0]): RouteResult => {
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
    };
    if (alternatives && routes.length > 1) {
      return routes.map(toResult);
    }
    return toResult(routes[0]);
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

  /** Fetch weather conditions for a location using OpenWeather API */
  private async fetchWeather(lat: number, lng: number): Promise<{ condition: string; temp: number; icon: string } | null> {
    if (!OPENWEATHER_API_KEY) return null;
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=metric`;
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        weather?: Array<{ main?: string; icon?: string }>;
        main?: { temp?: number };
      };
      const condition = data.weather?.[0]?.main ?? 'Unknown';
      const temp = data.main?.temp ?? 0;
      const icon = data.weather?.[0]?.icon ?? '01d';
      return { condition, temp, icon };
    } catch (e) {
      console.warn('[GeoService] OpenWeather API failed:', e);
      return null;
    }
  }

  /** Fetch traffic incidents along a route using TomTom Traffic API */
  private async fetchTrafficIncidents(
    bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number }
  ): Promise<Array<{ type: 'accident' | 'construction' | 'closure' | 'congestion'; description: string; severity: 'low' | 'moderate' | 'high' }>> {
    if (!TOMTOM_API_KEY) return [];
    try {
      const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${TOMTOM_API_KEY}&bbox=${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code,iconCategory}}}}`;
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        incidents?: Array<{
          properties?: {
            iconCategory?: number;
            magnitudeOfDelay?: number;
            events?: Array<{ description?: string; code?: number }>;
          };
        }>;
      };
      const incidents: Array<{ type: 'accident' | 'construction' | 'closure' | 'congestion'; description: string; severity: 'low' | 'moderate' | 'high' }> = [];
      for (const inc of data.incidents ?? []) {
        const props = inc.properties;
        if (!props) continue;
        // Map TomTom icon categories to our types
        let type: 'accident' | 'construction' | 'closure' | 'congestion' = 'congestion';
        const iconCat = props.iconCategory ?? 0;
        if (iconCat === 1 || iconCat === 2) type = 'accident';
        else if (iconCat === 3 || iconCat === 4) type = 'construction';
        else if (iconCat === 5 || iconCat === 6) type = 'closure';

        const description = props.events?.[0]?.description ?? 'Traffic incident';
        const delay = props.magnitudeOfDelay ?? 0;
        const severity: 'low' | 'moderate' | 'high' = delay < 2 ? 'low' : delay < 5 ? 'moderate' : 'high';
        incidents.push({ type, description, severity });
      }
      return incidents;
    } catch (e) {
      console.warn('[GeoService] TomTom Traffic API failed:', e);
      return [];
    }
  }

  /** Enrich route with weather and traffic incident data */
  async enrichRouteData(route: RouteResult, pickup: { lat: number; lng: number }, dropoff: { lat: number; lng: number }): Promise<RouteResult> {
    // Fetch weather at destination
    const weather = await this.fetchWeather(dropoff.lat, dropoff.lng);

    // Calculate bounding box for traffic incidents
    const minLat = Math.min(pickup.lat, dropoff.lat) - 0.05;
    const maxLat = Math.max(pickup.lat, dropoff.lat) + 0.05;
    const minLng = Math.min(pickup.lng, dropoff.lng) - 0.05;
    const maxLng = Math.max(pickup.lng, dropoff.lng) + 0.05;

    const incidents = await this.fetchTrafficIncidents({ minLat, minLng, maxLat, maxLng });

    return {
      ...route,
      weather: weather ?? undefined,
      incidents: incidents.length > 0 ? incidents : undefined,
    };
  }
}
