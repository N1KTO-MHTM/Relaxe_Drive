import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PlanningService } from './planning.service';
import { GeoService } from '../geo/geo.service';

@Controller('planning')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'DISPATCHER', 'DRIVER')
export class PlanningController {
  constructor(
    private planningService: PlanningService,
    private geo: GeoService,
  ) { }

  @Get()
  getPlanning() {
    return this.planningService.getPlanningResult(60);
  }

  @Get('order-coords')
  getOrderCoords() {
    return this.planningService.getOrderCoords(120);
  }

  @Get('problem-zones')
  getProblemZones() {
    return this.planningService.getProblemZones(90);
  }

  @Post('route')
  async getRoute(
    @Body() body: { pickup: { lat: number; lng: number }; dropoff?: { lat: number; lng: number }; waypoints?: { lat: number; lng: number }[]; alternatives?: boolean },
  ) {
    if (!body.pickup) return null;
    const points = [body.pickup];
    if (body.waypoints) points.push(...body.waypoints);
    if (body.dropoff) points.push(body.dropoff);

    if (body.alternatives && body.pickup && body.dropoff && (!body.waypoints || body.waypoints.length === 0)) {
      // Single leg with alternatives
      const alts = await this.geo.getRouteAlternatives(body.pickup, body.dropoff);
      return {
        ...alts[0],
        alternativeRoutes: alts.map(a => ({ polyline: a.polyline, durationMinutes: a.durationMinutes, distanceKm: a.distanceKm })),
      };
    }
    return this.geo.getRouteMulti(points);
  }
}
