import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RelaxDriveWsGateway } from '../websocket/websocket.gateway';

export const REPORT_TYPES = ['POLICE', 'TRAFFIC', 'WORK_ZONE', 'CAR_CRASH', 'OTHER'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ws: RelaxDriveWsGateway,
  ) {}

  async create(data: { lat: number; lng: number; type: ReportType; description?: string; userId: string }) {
    const report = await this.prisma.driverReport.create({
      data: {
        lat: data.lat,
        lng: data.lng,
        type: data.type,
        description: data.description ?? null,
        userId: data.userId,
      },
    });
    this.ws.broadcastReport(report);
    return report;
  }

  async findInBounds(
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number,
    sinceMinutes = 120,
  ) {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
    return this.prisma.driverReport.findMany({
      where: {
        lat: { gte: minLat, lte: maxLat },
        lng: { gte: minLng, lte: maxLng },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
