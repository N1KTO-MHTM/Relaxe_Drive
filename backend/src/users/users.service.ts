import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PassengersService } from '../passengers/passengers.service';
import { RelaxDriveWsGateway } from '../websocket/websocket.gateway';
import type { Role } from '../common/types/role';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private passengersService: PassengersService,
    private eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => RelaxDriveWsGateway))
    private ws: RelaxDriveWsGateway,
  ) {}

  async getUserCount(): Promise<number> {
    return this.prisma.user.count();
  }

  async findByNickname(nickname: string) {
    return this.prisma.user.findUnique({ where: { nickname } });
  }

  /** Find user by nickname for login; tries exact, lowercase, and title-case matches to handle device variance. */
  async findByNicknameForLogin(nickname: string) {
    const raw = nickname?.trim() ?? '';
    if (raw.length === 0) return null;

    // 1. Precise match
    let user = await this.prisma.user.findUnique({ where: { nickname: raw } });
    if (user) return user;

    // 2. Lowercase match
    const lower = raw.toLowerCase();
    user = await this.prisma.user.findUnique({ where: { nickname: lower } });
    if (user) return user;

    // 3. Title-case match (e.g. "admin" -> "Admin")
    const title = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    if (title !== raw && title !== lower) {
      user = await this.prisma.user.findUnique({ where: { nickname: title } });
      if (user) return user;
    }

    return null;
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
        carId: true,
        carType: true,
        carPlateNumber: true,
        carPlateType: true,
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
    if (updated.count === 0)
      throw new NotFoundException('Pending driver not found or already approved');
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

  /** Next driverId: numeric sequence 1, 2, 3, ... (driver = person). */
  private async nextDriverId(): Promise<string> {
    const users = await this.prisma.user.findMany({
      where: { driverId: { not: null } },
      select: { driverId: true },
    });
    let maxNum = 0;
    for (const u of users) {
      if (!u.driverId) continue;
      const num = parseInt(u.driverId, 10);
      if (!Number.isNaN(num) && num > maxNum) maxNum = num;
    }
    return String(maxNum + 1);
  }

  /** Next carId: [CarType][Sequence] e.g. Minivan1, Sedan1. */
  private async nextCarIdByType(carType: string): Promise<string> {
    if (!carType) return '';
    const typeNormalized = carType.trim().toUpperCase(); // SEDAN, MINIVAN, SUV
    // Find all users with this car type and a carId
    const users = await this.prisma.user.findMany({
      where: {
        carId: { not: null },
        carType: typeNormalized, // Strict match on type
      },
      select: { carId: true },
    });

    // Extract numbers from carIds (e.g. "Minivan1" -> 1)
    let maxNum = 0;
    // We assume carType casing in ID might vary, so we just look for digits
    // Ideally we prefix with TitleCase of type, e.g. Minivan, Sedan, Suv
    const prefix = typeNormalized.charAt(0).toUpperCase() + typeNormalized.slice(1).toLowerCase();

    for (const u of users) {
      if (!u.carId) continue;
      // Remove non-digits
      const numStr = u.carId.replace(/\D/g, '');
      const num = parseInt(numStr, 10);
      if (!Number.isNaN(num) && num > maxNum) maxNum = num;
    }

    return `${prefix}${maxNum + 1}`;
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
    carPlateType?: string;
    carId?: string;
    carType?: string;
    carCapacity?: number;
    carModelAndYear?: string;
  }) {
    const nick = (data.nickname || '').trim();
    const pass = (data.password || '').trim();
    if (!nick || !pass) throw new BadRequestException('Nickname and password required');

    const existing = await this.findByNickname(nick);
    if (existing) throw new ConflictException('Nickname already registered');

    if (data.email?.trim()) {
      const existingEmail = await this.findByEmail(data.email.trim());
      if (existingEmail) throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    let driverId: string | null = null;
    let carId: string | null = null;
    if (data.role === 'DRIVER') {
      driverId = await this.nextDriverId();
      if (data.carType) {
        carId = await this.nextCarIdByType(data.carType);
      }
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
        carPlateType: data.carPlateType?.trim().toUpperCase() || null,
        carId: data.carId?.trim() || carId,
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
        carId: true,
        carType: true,
        carPlateNumber: true,
        carPlateType: true,
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
    return users.map(
      ({
        sessions,
        id,
        nickname,
        email,
        phone,
        role,
        createdAt,
        driverId,
        carId,
        carType,
        carPlateNumber,
      }) => ({
        id,
        nickname,
        email,
        phone,
        role,
        driverId,
        carId,
        carType,
        carPlateNumber,
        createdAt,
        hasActiveSession: sessions.length > 0,
        lastActiveAt: sessions[0]?.lastActiveAt ?? null,
        device: sessions[0]?.device ?? null,
        ip: sessions[0]?.ip ?? null,
      }),
    );
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: {
        sessions: { select: { id: true }, take: 1 },
      },
      orderBy: { nickname: 'asc' },
    });
    return users.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      email: u.email,
      phone: u.phone,
      role: u.role,
      locale: u.locale,
      lat: u.lat,
      lng: u.lng,
      available: u.available,
      blocked: u.blocked,
      bannedUntil: u.bannedUntil,
      banReason: u.banReason,
      driverId: u.driverId,
      carId: u.carId,
      carType: u.carType,
      carPlateNumber: u.carPlateNumber,
      carCapacity: u.carCapacity,
      carModelAndYear: u.carModelAndYear,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      online: u.online,
    }));
  }

  async updateOnline(userId: string, online: boolean) {
    const result = await this.prisma.user.update({
      where: { id: userId },
      data: { online },
      select: { id: true, nickname: true },
    });
    this.ws.broadcastDrivers(await this.findAll());
    return result;
  }

  async updateAvailable(userId: string, available: boolean) {
    const result = await this.prisma.user.update({
      where: { id: userId },
      data: { available },
      select: { id: true, available: true },
    });
    this.eventEmitter.emit('planning.recalculate');
    this.ws.broadcastDrivers(await this.findAll());
    return result;
  }

  async updateLocation(userId: string, lat: number, lng: number) {
    const result = await this.prisma.user.update({
      where: { id: userId },
      data: { lat, lng },
      select: { id: true, nickname: true, lat: true, lng: true },
    });
    this.ws.broadcastDrivers(await this.findAll());
    return result;
  }

  async updateRole(userId: string, role: Role) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, nickname: true, role: true },
    });
  }

  async setPassword(userId: string, newPassword: string) {
    const pass = (newPassword || '').trim();
    if (pass.length < 6) throw new BadRequestException('Password too short');
    const passwordHash = await bcrypt.hash(pass, 10);

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

  /** Update driver's Car ID and/or Driver ID (admin). Driver ID = person, Car ID = vehicle; they can differ (e.g. driver 31, car 50). */
  async updateDriverIds(userId: string, data: { driverId?: string | null; carId?: string | null }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'DRIVER') throw new NotFoundException('Driver not found');
    const update: { driverId?: string | null; carId?: string | null } = {};
    if (data.driverId !== undefined) update.driverId = data.driverId?.trim() || null;
    if (data.carId !== undefined) update.carId = data.carId?.trim() || null;
    if (Object.keys(update).length === 0)
      return this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, nickname: true, driverId: true, carId: true },
      });
    return this.prisma.user.update({
      where: { id: userId },
      data: update,
      select: {
        id: true,
        nickname: true,
        driverId: true,
        carId: true,
        carType: true,
        carPlateNumber: true,
        carPlateType: true,
      },
    });
  }

  /** Trip history for driver. Optional from/to (ISO) filter; otherwise last 7 days. */
  async getTripHistory(driverId: string, from?: string, to?: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const completedAt: { gte?: Date; lte?: Date } = { gte: since };
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) completedAt.gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) completedAt.lte = toDate;
    }
    return this.prisma.driverTripSummary.findMany({
      where: { driverId, completedAt },
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
      idleAvg: row?.idleAvg ?? null,
      lateRate: row?.lateRate ?? null,
      rejectRate: row?.rejectRate ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  /** Recompute idleAvg, lateRate, rejectRate for all drivers (called from cron). */
  async recomputeAllDriverStats(): Promise<void> {
    const drivers = await this.prisma.user.findMany({
      where: { role: 'DRIVER' },
      select: { id: true },
    });
    for (const d of drivers) {
      await this.recomputeDriverStats(d.id);
    }
  }

  private async recomputeDriverStats(driverId: string): Promise<void> {
    const bufferMs = 15 * 60 * 1000; // 15 min default
    const completed = await this.prisma.order.findMany({
      where: { driverId, status: 'COMPLETED' },
      select: { pickupAt: true, arrivedAtPickupAt: true, bufferMinutes: true },
    });
    let lateCount = 0;
    for (const o of completed) {
      if (!o.arrivedAtPickupAt) continue;
      const buffer = (o.bufferMinutes ?? 15) * 60 * 1000;
      if (o.arrivedAtPickupAt.getTime() > o.pickupAt.getTime() + buffer) lateCount++;
    }
    const lateRate = completed.length > 0 ? lateCount / completed.length : null;

    const assignLogs = await this.prisma.auditLog.findMany({
      where: { action: 'order.assign', resource: 'order' },
      select: { payload: true },
    });
    let assignCount = 0;
    for (const a of assignLogs) {
      try {
        const p = a.payload ? JSON.parse(a.payload) : {};
        if (p.driverId === driverId) assignCount++;
      } catch {
        // ignore
      }
    }
    const rejectCount = await this.prisma.auditLog.count({
      where: { userId: driverId, action: 'order.driver_reject', resource: 'order' },
    });
    const rejectRate =
      assignCount + rejectCount > 0 ? rejectCount / (assignCount + rejectCount) : null;

    const trips = await this.prisma.driverTripSummary.findMany({
      where: { driverId },
      orderBy: { completedAt: 'asc' },
      select: { startedAt: true, completedAt: true },
    });
    let idleAvg: number | null = null;
    if (trips.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < trips.length; i++) {
        const gapMs = trips[i].startedAt.getTime() - trips[i - 1].completedAt.getTime();
        if (gapMs > 0) gaps.push(gapMs / 60_000);
      }
      idleAvg = gaps.length > 0 ? gaps.reduce((s, g) => s + g, 0) / gaps.length : null;
    } else if (trips.length === 1) {
      const lastCompleted = trips[trips.length - 1].completedAt.getTime();
      idleAvg = Math.max(0, (Date.now() - lastCompleted) / 60_000);
    }

    await this.prisma.driverStats.upsert({
      where: { driverId },
      create: {
        driverId,
        totalEarningsCents: 0,
        totalMiles: 0,
        idleAvg,
        lateRate,
        rejectRate,
        updatedAt: new Date(),
      },
      update: { idleAvg, lateRate, rejectRate, updatedAt: new Date() },
    });
  }

  /** Delete a user (admin only). Cannot delete self, any admin, or the last admin. */
  async deleteUser(targetUserId: string, requestingAdminId: string) {
    if (targetUserId === requestingAdminId) {
      throw new ConflictException('Cannot delete your own account');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === 'ADMIN') {
      throw new ConflictException('Cannot delete an administrator');
    }
    await this.prisma.order.updateMany({
      where: { createdById: targetUserId },
      data: { createdById: requestingAdminId },
    });
    await this.prisma.order.updateMany({
      where: { driverId: targetUserId },
      data: { driverId: null },
    });
    await this.prisma.auditLog.deleteMany({ where: { userId: targetUserId } });
    await this.prisma.passenger.updateMany({
      where: { userId: targetUserId },
      data: { userId: null },
    });
    await this.prisma.translationRecord.updateMany({
      where: { userId: targetUserId },
      data: { userId: null },
    });
    await this.prisma.driverReport.deleteMany({ where: { userId: targetUserId } });
    await this.prisma.driverTripSummary.deleteMany({ where: { driverId: targetUserId } });
    await this.prisma.driverStats.deleteMany({ where: { driverId: targetUserId } });
    await this.prisma.user.delete({ where: { id: targetUserId } });
    return { deleted: true };
  }

  /** Wipe all non-admin users. Admins are never touched. Caller must be ADMIN. */
  async wipeNonAdminUsers(adminId: string): Promise<{ deleted: number }> {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    if (admins.length === 0) throw new ConflictException('No admin account exists');
    const toDelete = await this.prisma.user.findMany({
      where: { role: { not: 'ADMIN' } },
      select: { id: true },
    });
    const ids = toDelete.map((u) => u.id);
    if (ids.length === 0) return { deleted: 0 };

    await this.prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: { createdById: { in: ids } },
        data: { createdById: adminId },
      });
      await tx.order.updateMany({
        where: { driverId: { in: ids } },
        data: { driverId: null },
      });
      await tx.auditLog.deleteMany({ where: { userId: { in: ids } } });
      await tx.passenger.updateMany({
        where: { userId: { in: ids } },
        data: { userId: null },
      });
      await tx.translationRecord.updateMany({
        where: { userId: { in: ids } },
        data: { userId: null },
      });
      await tx.driverReport.deleteMany({ where: { userId: { in: ids } } });
      await tx.driverTripSummary.deleteMany({ where: { driverId: { in: ids } } });
      await tx.driverStats.deleteMany({ where: { driverId: { in: ids } } });
      await tx.session.deleteMany({ where: { userId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    });

    this.eventEmitter.emit('planning.recalculate');
    this.ws.broadcastDrivers(await this.findAll());
    return { deleted: ids.length };
  }

  /** Wipe ALL users and all dependent data. Use only for bootstrap/reset. Returns count of deleted users. */
  async wipeAllUsers(): Promise<{ deleted: number }> {
    const userIds = await this.prisma.user.findMany({ select: { id: true } }).then((u) => u.map((x) => x.id));
    if (userIds.length === 0) return { deleted: 0 };

    await this.prisma.$transaction(async (tx) => {
      await tx.orderEvent.deleteMany({});
      await tx.order.updateMany({ data: { driverId: null } });
      await tx.order.deleteMany({});
      await tx.session.deleteMany({});
      await tx.auditLog.deleteMany({});
      await tx.chatMessage.deleteMany({});
      await tx.chat.deleteMany({});
      await tx.passenger.updateMany({ data: { userId: null } });
      await tx.translationRecord.deleteMany({});
      await tx.driverReport.deleteMany({});
      await tx.driverTripSummary.deleteMany({});
      await tx.driverStats.deleteMany({});
      await tx.user.deleteMany({});
    });

    return { deleted: userIds.length };
  }

  /** Create an admin user (for bootstrap). No approval needed. */
  async createAdmin(nickname: string, password: string) {
    const nick = (nickname || '').trim();
    const pass = (password || '').trim();
    if (!nick || !pass) throw new BadRequestException('Nickname and password required');
    const existing = await this.findByNickname(nick);
    if (existing) throw new ConflictException('Nickname already registered');
    const passwordHash = await bcrypt.hash(pass, 10);
    return this.prisma.user.create({
      data: {
        nickname: nick,
        passwordHash,
        role: 'ADMIN',
        locale: 'en',
      },
      select: {
        id: true,
        nickname: true,
        role: true,
        createdAt: true,
      },
    });
  }
}
