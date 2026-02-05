import { Controller, Get, UseGuards } from '@nestjs/common';
import { CostControlService } from './cost-control.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { logger } from '../common/logger';

const FALLBACK_COSTS = { maps: 0, translation: 0, ai: 0, tts: 0 };

@Controller('cost-control')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CostControlController {
  constructor(private readonly costControl: CostControlService) {}

  @Get()
  async getCosts() {
    try {
      return await this.costControl.getCosts();
    } catch (err) {
      logger.error('Cost control getCosts failed', 'CostControlController', {
        message: err instanceof Error ? err.message : String(err),
      });
      return FALLBACK_COSTS;
    }
  }
}
