import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { Role } from '../common/types/role';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByNickname(nickname: string) {
    return this.prisma.user.findUnique({ where: { nickname } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: { nickname: string; password: string; role: Role; email?: string; locale?: string; tenantId?: string }) {
    const existing = await this.findByNickname(data.nickname);
    if (existing) throw new ConflictException('Nickname already registered');
    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        nickname: data.nickname,
        email: data.email ?? null,
        passwordHash,
        role: data.role,
        locale: data.locale ?? 'en',
        tenantId: data.tenantId,
      },
      select: { id: true, nickname: true, email: true, role: true, locale: true, createdAt: true },
    });
  }

  async createSession(userId: string, device?: string, ip?: string) {
    return this.prisma.session.create({
      data: { userId, device, ip },
    });
  }

  async revokeSession(sessionId: string) {
    return this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  async getActiveSessions(userId?: string) {
    const where = userId ? { userId } : {};
    return this.prisma.session.findMany({
      where,
      include: { user: { select: { nickname: true, role: true } } },
      orderBy: { lastActiveAt: 'desc' },
    });
  }
}
