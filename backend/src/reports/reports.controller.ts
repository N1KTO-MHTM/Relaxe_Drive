import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService, REPORT_TYPES, type ReportType } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'DISPATCHER', 'DRIVER')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  list(
    @Query('minLat') minLat: string,
    @Query('maxLat') maxLat: string,
    @Query('minLng') minLng: string,
    @Query('maxLng') maxLng: string,
    @Query('sinceMinutes') sinceMinutes?: string,
  ) {
    const minLatN = parseFloat(minLat);
    const maxLatN = parseFloat(maxLat);
    const minLngN = parseFloat(minLng);
    const maxLngN = parseFloat(maxLng);
    const since = sinceMinutes ? parseInt(sinceMinutes, 10) : 120;
    if (!Number.isFinite(minLatN) || !Number.isFinite(maxLatN) || !Number.isFinite(minLngN) || !Number.isFinite(maxLngN)) {
      return [];
    }
    return this.reports.findInBounds(minLatN, maxLatN, minLngN, maxLngN, Number.isFinite(since) ? since : 120);
  }

  @Post()
  async create(
    @Body() body: { lat: number; lng: number; type: string; description?: string },
    @Request() req: { user: { id: string } },
  ) {
    const type = REPORT_TYPES.includes(body.type as ReportType) ? (body.type as ReportType) : 'OTHER';
    return this.reports.create({
      lat: body.lat,
      lng: body.lng,
      type,
      description: body.description,
      userId: req.user.id,
    });
  }
}
