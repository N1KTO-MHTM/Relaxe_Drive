import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    userId: string | null,
    action: string,
    resource: string,
    payload: Record<string, unknown> = {},
    ip?: string,
  ) {
    return this.prisma.auditLog.create({
      data: { userId, action, resource, payload: JSON.stringify(payload), ip },
    });
  }

  async find(filters: { userId?: string; action?: string; resource?: string; from?: Date; to?: Date }, limit = 100) {
    const where: Record<string, unknown> = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.resource) where.resource = filters.resource;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Record<string, Date>).gte = filters.from;
      if (filters.to) (where.createdAt as Record<string, Date>).lte = filters.to;
    }
    return this.prisma.auditLog.findMany({
      where,
      include: { user: { select: { nickname: true, role: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
