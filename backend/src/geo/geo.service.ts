import { Injectable } from '@nestjs/common';
import { CostTrackerService } from '../cost-tracker/cost-tracker.service';
import { withRetry } from '../common/http-resilience';
import { CircuitBreaker } from '../common/http-resilience';

const ORS_BASE = 'https://api.openrouteservice.org';

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  polyline: string;
}

export interface EtaResult {
  minutes: number;
}

/** Routes, ETA, GPS buffer, smart rerouting. Graceful degradation when Maps API unavailable. */
@Injectable()
export class GeoService {
  private readonly apiKey: string | undefined = process.env.OPENROUTE_API_KEY;
  private readonly circuit = new CircuitBreaker(5, 60_000);

  constructor(private readonly costTracker: CostTrackerService) {}

  async getRoute(
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
  ): Promise<RouteResult> {
    if (!this.apiKey) {
      return { distanceKm: 0, durationMinutes: 0, polyline: '' };
    }
    this.costTracker.increment('maps');
    try {
      return await this.circuit.run(() =>
        withRetry(() => this.fetchRoute(pickup, dropoff), { retries: 3, backoffMs: 500 }),
      );
    } catch (e) {
      console.warn('[GeoService] getRoute failed:', e);
      return { distanceKm: 0, durationMinutes: 0, polyline: '' };
    }
  }

  private async fetchRoute(
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
  ): Promise<RouteResult> {
    const coords = [
      [pickup.lng, pickup.lat],
      [dropoff.lng, dropoff.lat],
    ];
    const res = await fetch(`${ORS_BASE}/v2/directions/driving-car`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.apiKey!,
      },
      body: JSON.stringify({ coordinates: coords }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn('[GeoService] OpenRouteService error:', res.status, err);
      throw new Error(`ORS ${res.status}: ${err}`);
    }
    const data = (await res.json()) as {
      routes?: Array<{
        summary?: { distance?: number; duration?: number };
        geometry?: string;
      }>;
    };
    const route = data.routes?.[0];
    const distanceM = route?.summary?.distance ?? 0;
    const durationS = route?.summary?.duration ?? 0;
    return {
      distanceKm: Math.round((distanceM / 1000) * 100) / 100,
      durationMinutes: Math.round((durationS / 60) * 10) / 10,
      polyline: route?.geometry ?? '',
    };
  }

  async getEta(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<EtaResult> {
    const route = await this.getRoute(from, to);
    return { minutes: route.durationMinutes };
  }
}
