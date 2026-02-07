import { Controller, Get, Post, Body, UseGuards, Request, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

  @Get()
  @Roles('DRIVER', 'ADMIN', 'DISPATCHER')
  async getMapReports(
    @Query('minLat') minLat?: string,
    @Query('maxLat') maxLat?: string,
    @Query('minLng') minLng?: string,
    @Query('maxLng') maxLng?: string,
    @Query('sinceMinutes') sinceMinutes?: string,
  ) {
    return this.reportsService.getMapReports({
      minLat: minLat ? parseFloat(minLat) : undefined,
      maxLat: maxLat ? parseFloat(maxLat) : undefined,
      minLng: minLng ? parseFloat(minLng) : undefined,
      maxLng: maxLng ? parseFloat(maxLng) : undefined,
      sinceMinutes: sinceMinutes ? parseInt(sinceMinutes, 10) : 120,
    });
  }

  @Post()
  @Roles('DRIVER', 'ADMIN', 'DISPATCHER')
  async createReport(
    @Request() req: any,
    @Body() body: { lat: number; lng: number; type: string; description?: string },
  ) {
    return this.reportsService.createReport({
      lat: body.lat,
      lng: body.lng,
      type: body.type,
      description: body.description,
      userId: req.user.userId,
    });
  }

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
