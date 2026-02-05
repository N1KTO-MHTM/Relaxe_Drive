import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
        status: 'SCHEDULED',
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

  async assignDriver(orderId: string, driverId: string) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { driverId, status: 'ASSIGNED' },
    });
  }

  async updateStatus(orderId: string, status: 'IN_PROGRESS' | 'COMPLETED') {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    const allowed: Record<string, string[]> = {
      IN_PROGRESS: ['ASSIGNED'],
      COMPLETED: ['IN_PROGRESS'],
    };
    if (!allowed[status]?.includes(order.status)) {
      throw new BadRequestException(`Cannot set status ${status} from ${order.status}`);
    }
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
  }

  async findByDateRange(from: Date, to: Date) {
    return this.prisma.order.findMany({
      where: { pickupAt: { gte: from, lte: to } },
      orderBy: { pickupAt: 'asc' },
    });
  }
}
