import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
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

  /** Find user by nickname; tries exact match, then title-case (e.g. "admin" → "Admin") for login. */
  async findByNicknameForLogin(nickname: string) {
    const trimmed = nickname?.trim() ?? '';
    const user = await this.prisma.user.findUnique({ where: { nickname: trimmed } });
    if (user) return user;
    if (trimmed.length === 0) return null;
    const title = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    if (title === trimmed) return null;
    return this.prisma.user.findUnique({ where: { nickname: title } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findPendingDrivers() {
    return this.prisma.user.findMany({
      where: { role: 'DRIVER', approvedAt: null },
      select: {
        id: true,
        nickname: true,
        email: true,
        phone: true,
        driverId: true,
        carType: true,
        carPlateNumber: true,
        carCapacity: true,
        carModelAndYear: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveDriver(userId: string) {
    const updated = await this.prisma.user.updateMany({
      where: { id: userId, role: 'DRIVER', approvedAt: null },
      data: { approvedAt: new Date() },
    });
    if (updated.count === 0) throw new NotFoundException('Pending driver not found or already approved');
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nickname: true, approvedAt: true },
    });
  }

  /** Reject pending driver: remove account so they can register again. */
  async rejectDriver(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role: 'DRIVER', approvedAt: null },
    });
    if (!user) throw new NotFoundException('Pending driver not found or already approved');
    await this.prisma.auditLog.deleteMany({ where: { userId } });
    await this.prisma.passenger.updateMany({ where: { userId }, data: { userId: null } });
    await this.prisma.translationRecord.updateMany({ where: { userId }, data: { userId: null } });
    await this.prisma.driverReport.deleteMany({ where: { userId } });
    await this.prisma.driverTripSummary.deleteMany({ where: { driverId: userId } });
    await this.prisma.driverStats.deleteMany({ where: { driverId: userId } });
    await this.prisma.user.delete({ where: { id: userId } });
    return { deleted: true };
  }

  /** Next driverId for carType (e.g. 001suv, 002sedan). */
  private async nextDriverIdForCarType(carType: string): Promise<string> {
    const normalized = (carType || '').toUpperCase();
    if (!['SEDAN', 'MINIVAN', 'SUV'].includes(normalized)) return '';
    const suffix = normalized.toLowerCase();
    const users = await this.prisma.user.findMany({
      where: { driverId: { not: null }, carType: normalized },
      select: { driverId: true },
    });
    let maxNum = 0;
    const prefix = suffix; // e.g. "001" + "suv"
    for (const u of users) {
      if (!u.driverId || !u.driverId.endsWith(suffix)) continue;
      const num = parseInt(u.driverId.slice(0, -suffix.length), 10);
      if (!Number.isNaN(num) && num > maxNum) maxNum = num;
    }
    const next = (maxNum + 1).toString().padStart(3, '0');
    return next + suffix;
  }

  async create(data: {
    nickname: string;
    password: string;
    role: Role;
    email?: string;
    phone?: string;
    locale?: string;
    tenantId?: string;
    carPlateNumber?: string;
    carType?: string;
    carCapacity?: number;
    carModelAndYear?: string;
  }) {
    const existing = await this.findByNickname(data.nickname);
    if (existing) throw new ConflictException('Nickname already registered');
    if (data.email?.trim()) {
      const existingEmail = await this.findByEmail(data.email.trim());
      if (existingEmail) throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    let driverId: string | null = null;
    if (data.role === 'DRIVER' && data.carType?.trim()) {
      driverId = await this.nextDriverIdForCarType(data.carType.trim());
    }
    const user = await this.prisma.user.create({
      data: {
        nickname: data.nickname,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        passwordHash,
        role: data.role,
        locale: data.locale ?? 'en',
        tenantId: data.tenantId,
        carPlateNumber: data.carPlateNumber?.trim() || null,
        carType: data.carType?.trim().toUpperCase() || null,
        carCapacity: data.carCapacity ?? null,
        carModelAndYear: data.carModelAndYear?.trim() || null,
        driverId,
      },
      select: {
        id: true,
        nickname: true,
        email: true,
        phone: true,
        role: true,
        locale: true,
        driverId: true,
        carType: true,
        carPlateNumber: true,
        carCapacity: true,
        carModelAndYear: true,
        createdAt: true,
      },
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

  /** Update lastActiveAt for all sessions of this user (called on each authenticated request). */
  async touchSessionsByUserId(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId },
      data: { lastActiveAt: new Date() },
    });
  }

  /** Active sessions: one row per user (latest session only), so online users are not duplicated. */
  async getActiveSessions(userId?: string) {
    const where = userId ? { userId } : {};
    const sessions = await this.prisma.session.findMany({
      where,
      include: { user: { select: { nickname: true, role: true, phone: true } } },
      orderBy: { lastActiveAt: 'desc' },
    });
    const byUser = new Map<string, (typeof sessions)[0]>();
    for (const s of sessions) {
      if (!byUser.has(s.userId)) byUser.set(s.userId, s);
    }
    return Array.from(byUser.values());
  }

  /** All registered users with active-session status (for admin logs). */
  async findAllWithSessionStatus() {
    const users = await this.prisma.user.findMany({
      orderBy: { nickname: 'asc' },
      include: { sessions: { orderBy: { lastActiveAt: 'desc' }, take: 1 } },
    });
    return users.map(({ sessions, id, nickname, email, phone, role, createdAt, driverId, carType, carPlateNumber }) => ({
      id,
      nickname,
      email,
      phone,
      role,
      driverId,
      carType,
      carPlateNumber,
      createdAt,
      hasActiveSession: sessions.length > 0,
      lastActiveAt: sessions[0]?.lastActiveAt ?? null,
      device: sessions[0]?.device ?? null,
      ip: sessions[0]?.ip ?? null,
    }));
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
        available: true,
        blocked: true,
        bannedUntil: true,
        banReason: true,
        driverId: true,
        carType: true,
        carPlateNumber: true,
        carCapacity: true,
        carModelAndYear: true,
        createdAt: true,
      },
      orderBy: { nickname: 'asc' },
    });
  }

  async updateAvailable(userId: string, available: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { available },
      select: { id: true, available: true },
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

  /** Trip history for driver (last 7 days; older rows are purged on each completion). */
  async getTripHistory(driverId: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.prisma.driverTripSummary.findMany({
      where: { driverId, completedAt: { gte: since } },
      orderBy: { completedAt: 'desc' },
    });
  }

  /** Aggregated earnings and miles for driver (persisted; not cleared by 7-day purge). */
  async getDriverStats(driverId: string) {
    const row = await this.prisma.driverStats.findUnique({
      where: { driverId },
    });
    return {
      totalEarningsCents: row?.totalEarningsCents ?? 0,
      totalMiles: row?.totalMiles ?? 0,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  /** Delete a user (admin only). Cannot delete self or the last admin. */
  async deleteUser(targetUserId: string, requestingAdminId: string) {
    if (targetUserId === requestingAdminId) {
      throw new ConflictException('Cannot delete your own account');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');
    const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
    if (target.role === 'ADMIN' && adminCount <= 1) {
      throw new ConflictException('Cannot delete the last administrator');
    }
    await this.prisma.order.updateMany({ where: { createdById: targetUserId }, data: { createdById: requestingAdminId } });
    await this.prisma.order.updateMany({ where: { driverId: targetUserId }, data: { driverId: null } });
    await this.prisma.auditLog.deleteMany({ where: { userId: targetUserId } });
    await this.prisma.passenger.updateMany({ where: { userId: targetUserId }, data: { userId: null } });
    await this.prisma.translationRecord.updateMany({ where: { userId: targetUserId }, data: { userId: null } });
    await this.prisma.driverReport.deleteMany({ where: { userId: targetUserId } });
    await this.prisma.driverTripSummary.deleteMany({ where: { driverId: targetUserId } });
    await this.prisma.driverStats.deleteMany({ where: { driverId: targetUserId } });
    await this.prisma.user.delete({ where: { id: targetUserId } });
    return { deleted: true };
  }
}
