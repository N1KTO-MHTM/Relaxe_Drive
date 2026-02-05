import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PassengersService } from '../passengers/passengers.service';
import type { Role } from '../common/types/role';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private passengersService: PassengersService,
  ) {}

  async findByNickname(nickname: string) {
    return this.prisma.user.findUnique({ where: { nickname } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: { nickname: string; password: string; role: Role; email?: string; phone?: string; locale?: string; tenantId?: string }) {
    const existing = await this.findByNickname(data.nickname);
    if (existing) throw new ConflictException('Nickname already registered');
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        nickname: data.nickname,
        email: data.email ?? null,
        phone: data.phone ?? null,
        passwordHash,
        role: data.role,
        locale: data.locale ?? 'en',
        tenantId: data.tenantId,
      },
      select: { id: true, nickname: true, email: true, phone: true, role: true, locale: true, createdAt: true },
    });
    if (data.role === 'DRIVER' && data.phone?.trim()) {
      await this.passengersService.linkDriverToPassenger(data.phone.trim(), user.id);
    }
    return user;
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

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        nickname: true,
        email: true,
        phone: true,
        role: true,
        locale: true,
        lat: true,
        lng: true,
        blocked: true,
        bannedUntil: true,
        banReason: true,
        createdAt: true,
      },
      orderBy: { nickname: 'asc' },
    });
  }

  async updateLocation(userId: string, lat: number, lng: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lat, lng },
      select: { id: true, nickname: true, lat: true, lng: true },
    });
  }

  async updateRole(userId: string, role: Role) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, nickname: true, role: true },
    });
  }

  async setPassword(userId: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { id: true, nickname: true },
    });
  }

  async setBlocked(userId: string, blocked: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { blocked },
      select: { id: true, nickname: true, blocked: true },
    });
  }

  async setBan(userId: string, bannedUntil: Date | null, banReason: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { bannedUntil, banReason },
      select: { id: true, nickname: true, bannedUntil: true, banReason: true },
    });
  }

  async updateLocale(userId: string, locale: string) {
    const allowed = ['en', 'ru', 'ka', 'es'];
    const lng = allowed.includes(locale) ? locale : 'en';
    return this.prisma.user.update({
      where: { id: userId },
      data: { locale: lng },
      select: { id: true, nickname: true, role: true, locale: true },
    });
  }
}
