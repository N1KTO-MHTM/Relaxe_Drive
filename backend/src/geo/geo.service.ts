import { Injectable } from '@nestjs/common';

/** Routes, ETA, GPS buffer, smart rerouting. Graceful degradation when Maps API unavailable. */
@Injectable()
export class GeoService {
  async getRoute(pickup: { lat: number; lng: number }, dropoff: { lat: number; lng: number }) {
    return { distanceKm: 0, durationMinutes: 0, polyline: '' };
  }

  async getEta(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
    return { minutes: 0 };
  }
}
