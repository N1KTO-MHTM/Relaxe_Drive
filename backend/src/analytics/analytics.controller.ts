import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AnalyticsService, AnalyticsStats } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'DISPATCHER')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('stats')
  async getStats(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<AnalyticsStats> {
    const toDate = (s: string) => {
      const d = new Date(s);
      return isNaN(d.getTime()) ? undefined : d;
    };
    const end = to && toDate(to) ? toDate(to)! : new Date();
    let start = from && toDate(from) ? toDate(from)! : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (start.getTime() > end.getTime()) start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    return this.analytics.getStats(start, end);
  }
}
