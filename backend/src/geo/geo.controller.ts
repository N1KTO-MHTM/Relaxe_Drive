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
}
