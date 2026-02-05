import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GeoService } from './geo.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('geo')
@UseGuards(JwtAuthGuard)
export class GeoController {
  constructor(private readonly geo: GeoService) {}

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
