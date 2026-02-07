import { Controller, Get, UseGuards, Request, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

  @Get('driver')
  @Roles('DRIVER', 'ADMIN', 'DISPATCHER')
  async getDriverReports(@Request() req: any) {
    // If Admin/Dispatcher, could allow query param ?driverId=...
    // For now, return reports for the requesting user if they are a driver
    // Or all reports if Admin (to be implemented)
    const userId = req.user.userId;
    return this.reportsService.getReportsForUser(userId, req.user.role);
  }

  @Get('download')
  @Roles('DRIVER', 'ADMIN', 'DISPATCHER')
  async downloadReport(
    @Query('driverId') driverId: string,
    @Query('month') month: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    // Security check: Drivers can only download their own
    if (req.user.role === 'DRIVER' && req.user.userId !== driverId) {
      return res.status(403).send('Forbidden');
    }

    const csv = await this.reportsService.generateCsv(driverId, month);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="report-${driverId}-${month}.csv"`,
    });
    return res.send(csv);
  }
}
