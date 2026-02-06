import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PlanningService } from './planning.service';

@Controller('planning')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'DISPATCHER')
export class PlanningController {
  constructor(private planningService: PlanningService) {}

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
}
