import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RelaxDriveWsGateway } from '../websocket/websocket.gateway';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: RelaxDriveWsGateway,
  ) { }

  async createReport(data: {
    lat: number;
    lng: number;
    type: string;
    description?: string;
    userId: string;
  }) {
    if (!data.userId || typeof data.userId !== 'string') {
      throw new UnauthorizedException('userId is required to create a report');
    }
    const report = await this.prisma.driverReport.create({
      data: {
        lat: data.lat,
        lng: data.lng,
        type: data.type,
        description: data.description,
        userId: data.userId,
      },
    });

    // Broadcast to all connected clients
    this.wsGateway.broadcastReport({
      id: report.id,
      lat: report.lat,
      lng: report.lng,
      type: report.type,
      description: report.description,
      createdAt: report.createdAt.toISOString(),
    });

    return report;
  }

  async getReportsForUser(userId: string, role: string) {
    const reports = [];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      // Aggregate from DriverTripSummary
      const stats = await this.prisma.driverTripSummary.aggregate({
        where: {
          driverId: role === 'DRIVER' ? userId : undefined,
          completedAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        _count: { id: true },
        _sum: {
          earningsCents: true,
        },
      });

      if (stats._count.id > 0) {
        reports.push({
          id: `report-${userId}-${monthKey}`,
          month: monthKey,
          driverId: userId,
          driverName: 'Driver',
          totalRides: stats._count.id,
          totalEarnings: stats._sum.earningsCents || 0,
          hoursOnline: 0,
          createdAt: endOfMonth.toISOString(),
          url: `/api/reports/download?driverId=${userId}&month=${monthKey}`,
        });
      }
    }
    // Sort by recent first
    return reports.sort((a, b) => b.month.localeCompare(a.month));
  }

  async generateCsv(driverId: string, month: string): Promise<string> {
    const [year, m] = month.split('-');
    const startOfMonth = new Date(parseInt(year), parseInt(m) - 1, 1);
    const endOfMonth = new Date(parseInt(year), parseInt(m), 0, 23, 59, 59);

    const trips = await this.prisma.driverTripSummary.findMany({
      where: {
        driverId,
        completedAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      orderBy: { completedAt: 'asc' },
    });

    const header = 'Date,Pickup,Dropoff,Distance(km),Earnings($)\n';
    const rows = trips.map(t => {
      const date = t.completedAt.toISOString().split('T')[0];
      const earnings = (t.earningsCents / 100).toFixed(2);
      // Escape commas in addresses
      const pickup = `"${t.pickupAddress.replace(/"/g, '""')}"`;
      const dropoff = `"${t.dropoffAddress.replace(/"/g, '""')}"`;
      return `${date},${pickup},${dropoff},${t.distanceKm},${earnings}`;
    });

    return header + rows.join('\n');
  }

  async getMapReports(params: {
    minLat?: number;
    maxLat?: number;
    minLng?: number;
    maxLng?: number;
    sinceMinutes?: number;
  }) {
    const sinceMinutes = params.sinceMinutes || 120;
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);

    const where: any = {
      createdAt: { gte: since },
    };

    // Geo-filtering if provided
    if (params.minLat !== undefined && params.maxLat !== undefined) {
      where.lat = { gte: params.minLat, lte: params.maxLat };
    }
    if (params.minLng !== undefined && params.maxLng !== undefined) {
      where.lng = { gte: params.minLng, lte: params.maxLng };
    }

    const reports = await this.prisma.driverReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to prevent overload
    });

    return reports.map(r => ({
      id: r.id,
      lat: r.lat,
      lng: r.lng,
      type: r.type,
      description: r.description,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // Auto-delete reports older than 5 minutes every 30 seconds
  @Cron('*/30 * * * * *')
  async autoDeleteOldReports() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await this.prisma.driverReport.deleteMany({
      where: {
        createdAt: { lt: fiveMinutesAgo },
      },
    });
  }

  // Run at 00:00 on the 1st day of every month
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleMonthlyReports() {
    // Implementation for automatic background generation 
    // (Optional if we generate on-the-fly via download)
  }
}
