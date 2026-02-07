import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GeoService } from './geo.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('geo')
@UseGuards(JwtAuthGuard)
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('geocode')
  async geocode(@Query('address') address: string) {
    if (!address?.trim()) return { lat: null, lng: null };
    const result = await this.geo.geocode(address.trim());
    return result ?? { lat: null, lng: null };
  }

  @Get('reverse')
  async reverse(
    @Query('lat') latStr: string,
    @Query('lng') lngStr: string,
  ) {
    const lat = latStr != null && latStr !== '' ? parseFloat(latStr) : NaN;
    const lng = lngStr != null && lngStr !== '' ? parseFloat(lngStr) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { address: null };
    }
    const result = await this.geo.reverseGeocode(lat, lng);
    return result ?? { address: null };
  }

  /** Route between two addresses (for map preview, e.g. Addresses tab). Returns polyline + duration/distance. */
  @Get('route')
  async route(
    @Query('origin') origin: string,
    @Query('destination') destination: string,
  ) {
    if (!origin?.trim() || !destination?.trim()) {
      return { polyline: '', durationMinutes: 0, distanceKm: 0, pickupCoords: null, dropoffCoords: null };
    }
    const pickupCoords = await this.geo.geocode(origin.trim());
    const dropoffCoords = await this.geo.geocode(destination.trim());
    if (!pickupCoords || !dropoffCoords) {
      return { polyline: '', durationMinutes: 0, distanceKm: 0, pickupCoords: pickupCoords ?? null, dropoffCoords: dropoffCoords ?? null };
    }
    const result = await this.geo.getRoute(pickupCoords, dropoffCoords);
    return {
      polyline: result.polyline,
      durationMinutes: result.durationMinutes,
      distanceKm: result.distanceKm,
      pickupCoords,
      dropoffCoords,
    };
  }
}
