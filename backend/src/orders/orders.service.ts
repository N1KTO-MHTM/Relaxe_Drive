import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    pickupAt: Date;
    pickupAddress: string;
    dropoffAddress: string;
    passengerId?: string;
    createdById: string;
    bufferMinutes?: number;
  }) {
    return this.prisma.order.create({
      data: {
        ...data,
        bufferMinutes: data.bufferMinutes ?? 15,
      },
    });
  }

  async findActiveAndScheduled() {
    return this.prisma.order.findMany({
      where: { status: { in: ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS'] } },
      orderBy: { pickupAt: 'asc' },
    });
  }

  async findConflicts(pickupAt: Date, bufferMinutes: number, excludeOrderId?: string) {
    const start = new Date(pickupAt.getTime() - bufferMinutes * 60 * 1000);
    const end = new Date(pickupAt.getTime() + bufferMinutes * 60 * 1000);
    return this.prisma.order.findMany({
      where: {
        pickupAt: { gte: start, lte: end },
        status: { in: ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS'] },
        ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
      },
    });
  }
}
