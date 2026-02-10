import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PassengersService } from '../passengers/passengers.service';

/** Wait billing: first 5 min free. Then: 20 min = $5, 30 min = $10, 1 h = $20, 1h20 = $25, 1h30 = $30, 2 h = $40. */
export function getWaitChargeCentsFromTotalMinutes(totalMinutes: number): number {
  if (totalMinutes < 20) return 0;
  if (totalMinutes < 30) return 500; // $5
  if (totalMinutes < 60) return 1000; // $10
  if (totalMinutes < 80) return 2000; // $20 (1 hour)
  if (totalMinutes < 90) return 2500; // $25 (1h 20m)
  if (totalMinutes < 120) return 3000; // $30 (1h 30m)
  return 4000; // $40 (2 hours)
}

/** From arrivedAt to leftAt: total minutes waited. Charge by total (20 min = $5, 30 = $10, 60 = $20). */
export function computeWaitCharge(
  arrivedAt: Date,
  leftAt: Date,
): { totalMinutes: number; chargeCents: number } {
  const totalMs = leftAt.getTime() - arrivedAt.getTime();
  const totalMinutes = Math.floor(totalMs / 60_000);
  const chargeCents = getWaitChargeCentsFromTotalMinutes(totalMinutes);
  return { totalMinutes, chargeCents };
}

/** Waypoint item for multiple stops: { address: string } */
export type OrderWaypoint = { address: string };

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private passengersService: PassengersService,
  ) {}

  async create(data: {
    pickupAt: Date;
    pickupAddress: string;
    dropoffAddress: string;
    tripType?: 'ONE_WAY' | 'ROUNDTRIP';
    routeType?: string | null;
    middleAddress?: string | null;
    waypoints?: OrderWaypoint[] | null;
    pickupType?: string | null;
    dropoffType?: string | null;
    passengerId?: string;
    preferredCarType?: string | null;
    createdById: string;
    bufferMinutes?: number;
    dropoffImageUrl?: string;
    status?: string;
  }) {
    const waypointsJson =
      data.waypoints && data.waypoints.length > 0 ? JSON.stringify(data.waypoints) : undefined;
    return this.prisma.order.create({
      data: {
        pickupAt: data.pickupAt,
        pickupAddress: data.pickupAddress,
        dropoffAddress: data.dropoffAddress,
        tripType: data.tripType ?? 'ONE_WAY',
        routeType: data.routeType ?? null,
        middleAddress: data.tripType === 'ROUNDTRIP' ? (data.middleAddress ?? null) : null,
        waypoints: waypointsJson,
        pickupType: data.pickupType ?? null,
        dropoffType: data.dropoffType ?? null,
        passengerId: data.passengerId ?? null,
        preferredCarType: data.preferredCarType ?? null,
        createdById: data.createdById,
        status: data.status ?? 'SCHEDULED',
        bufferMinutes: data.bufferMinutes ?? 15,
        dropoffImageUrl: data.dropoffImageUrl ?? null,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: { passenger: true },
    });
  }

  async findActiveAndScheduled(driverId?: string) {
    return this.prisma.order.findMany({
      where: {
        status: { in: ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS'] },
        ...(driverId ? { driverId } : {}),
      },
      orderBy: { pickupAt: 'asc' },
      include: { passenger: true },
    });
  }

  /** For driver-etas: drivers currently on a trip and their target (pickup or dropoff) address. */
  async findActiveTripTargetsByDriver(): Promise<Array<{ driverId: string; targetAddress: string }>> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
        driverId: { not: null },
      },
      select: { driverId: true, status: true, pickupAddress: true, dropoffAddress: true },
    });
    return orders
      .filter((o) => o.driverId != null)
      .map((o) => ({
        driverId: o.driverId!,
        targetAddress: o.status === 'ASSIGNED' ? o.pickupAddress : (o.dropoffAddress ?? o.pickupAddress),
      }));
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

  async acceptOrder(orderId: string, driverId: string) {
    // Atomic update to prevent race conditions
    const result = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        driverId: null,
        status: 'SEARCHING',
      },
      data: {
        driverId,
        status: 'ASSIGNED',
      },
    });

    if (result.count === 0) {
      throw new BadRequestException('Order not available or already taken');
    }

    return this.prisma.order.findUnique({ where: { id: orderId } });
  }

  /** Set pickupAt (e.g. driver arrive time from ETA after assign). */
  async updatePickupAt(orderId: string, pickupAt: Date) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { pickupAt },
    });
  }

  /** Set manual-assignment flag (dispatcher marked; no auto-suggest). */
  async setManualAssignment(orderId: string, manualAssignment: boolean) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { manualAssignment },
    });
  }

  async updateDestination(orderId: string, dropoffAddress: string) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { dropoffAddress },
    });
  }

  /** Add delay minutes to pickupAt (SCHEDULED or ASSIGNED only). */
  async delayOrder(orderId: string, delayMinutes: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'SCHEDULED' && order.status !== 'ASSIGNED') {
      throw new BadRequestException('Only scheduled or assigned orders can be delayed');
    }
    const newPickupAt = new Date(order.pickupAt.getTime() + delayMinutes * 60 * 1000);
    return this.prisma.order.update({
      where: { id: orderId },
      data: { pickupAt: newPickupAt },
    });
  }

  async driverReject(orderId: string, driverId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.driverId !== driverId)
      throw new BadRequestException('This order is not assigned to you');
    if (order.status !== 'ASSIGNED')
      throw new BadRequestException('Only assigned orders can be rejected');
    return this.prisma.order.update({
      where: { id: orderId },
      data: { driverId: null, status: 'SCHEDULED' },
    });
  }

  /** Driver declined an auto-order offer (order is SEARCHING). No DB change; audit only. */
  async driverDeclineOffer(orderId: string, driverId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'SEARCHING') return order;
    // No state change; order stays SEARCHING for other drivers
    return order;
  }

  /** Passenger requested an extra stop (not in original route). Add waypoint and keep trip IN_PROGRESS. */
  async stopUnderway(
    orderId: string,
    userId: string,
    location?: { lat: number; lng: number; address: string },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    // Get user to check role
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Only allow if user is the assigned driver OR is admin/dispatcher
    const isAssignedDriver = order.driverId === userId;
    const isAdminOrDispatcher = user.role === 'ADMIN' || user.role === 'DISPATCHER';

    if (!isAssignedDriver && !isAdminOrDispatcher) {
      throw new ForbiddenException(
        'Only the assigned driver, admins, or dispatchers can add passenger stops',
      );
    }

    if (order.status !== 'IN_PROGRESS')
      throw new BadRequestException('Only in-progress trips can add a passenger stop');
    let existing: { address: string }[] = [];
    if (order.waypoints) {
      try {
        existing = JSON.parse(order.waypoints);
      } catch {
        existing = [];
      }
    }
    const next = [...existing, { address: location?.address ?? 'Passenger stop (en route)' }];
    return this.prisma.order.update({
      where: { id: orderId },
      data: { waypoints: JSON.stringify(next) },
    });
  }

  async updateStatus(
    orderId: string,
    status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
    driverId?: string,
    body?: { distanceKm?: number; earningsCents?: number; routePolyline?: string },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (driverId && order.driverId !== driverId) {
      throw new BadRequestException('You can only update your own assigned orders');
    }
    const allowed: Record<string, string[]> = {
      IN_PROGRESS: ['ASSIGNED'],
      COMPLETED: ['IN_PROGRESS'],
      CANCELLED: ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS'],
    };
    if (!allowed[status]?.includes(order.status)) {
      throw new BadRequestException(`Cannot set status ${status} from ${order.status}`);
    }
    if (status === 'COMPLETED') {
      const now = new Date();
      if (order.driverId) {
        const distanceKm = body?.distanceKm ?? 0;
        const earningsCents = body?.earningsCents ?? 0;
        await this.prisma.driverTripSummary.create({
          data: {
            driverId: order.driverId,
            orderId: order.id,
            pickupAddress: order.pickupAddress ?? '',
            dropoffAddress: order.dropoffAddress ?? '',
            startedAt: order.startedAt ?? now,
            completedAt: now,
            distanceKm,
            earningsCents,
            routePolyline: body?.routePolyline ?? undefined,
          },
        });
        const milesToAdd = distanceKm / 1.60934;
        await this.prisma.driverStats.upsert({
          where: { driverId: order.driverId },
          create: {
            driverId: order.driverId,
            totalEarningsCents: earningsCents,
            totalMiles: milesToAdd,
            updatedAt: now,
          },
          update: {
            totalEarningsCents: { increment: earningsCents },
            totalMiles: { increment: milesToAdd },
            updatedAt: now,
          },
        });
        const purgeBefore = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        await this.prisma.driverTripSummary.deleteMany({
          where: { driverId: order.driverId, completedAt: { lt: purgeBefore } },
        });
      }
      if (order.passengerId && order.pickupAddress?.trim()) {
        const passenger = await this.prisma.passenger.findUnique({
          where: { id: order.passengerId },
        });
        if (passenger?.phone?.trim()) {
          const alreadyExists = await this.passengersService.existsByPhoneAndPickupAddr(
            passenger.phone,
            order.pickupAddress,
          );
          if (!alreadyExists) {
            await this.passengersService.findOrCreateByPhone(passenger.phone.trim(), {
              name: passenger.name ?? undefined,
              pickupAddr: order.pickupAddress.trim(),
            });
          }
        }
      }
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'COMPLETED', completedAt: now },
      });
      return this.prisma.order.findUnique({ where: { id: orderId } });
    }
    if (status === 'CANCELLED') {
      return this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', driverId: null }, // Clear driver assignment on cancellation
      });
    }
    const now = new Date();
    const data: {
      status: string;
      startedAt?: Date;
      leftPickupAt?: Date;
      waitChargeAtPickupCents?: number;
      leftMiddleAt?: Date;
      waitChargeAtMiddleCents?: number;
    } = {
      status,
      startedAt: status === 'IN_PROGRESS' ? now : undefined,
    };
    if (status === 'IN_PROGRESS') {
      if (order.arrivedAtPickupAt && !order.leftPickupAt) {
        let chargeCents = 0;
        const manualMinutes = (order as any).manualWaitMinutes;
        if (manualMinutes != null && typeof manualMinutes === 'number') {
          chargeCents = getWaitChargeCentsFromTotalMinutes(manualMinutes);
        } else {
          const { chargeCents: autoCharge } = computeWaitCharge(order.arrivedAtPickupAt, now);
          chargeCents = autoCharge;
        }
        data.leftPickupAt = now;
        data.waitChargeAtPickupCents = chargeCents;
      }
      if (order.tripType === 'ROUNDTRIP' && order.arrivedAtMiddleAt && !order.leftMiddleAt) {
        let chargeCents = 0;
        const manualMinutes = (order as any).manualWaitMiddleMinutes;
        if (manualMinutes != null && typeof manualMinutes === 'number') {
          chargeCents = getWaitChargeCentsFromTotalMinutes(manualMinutes);
        } else {
          const { chargeCents: autoCharge } = computeWaitCharge(order.arrivedAtMiddleAt, now);
          chargeCents = autoCharge;
        }
        data.leftMiddleAt = now;
        data.waitChargeAtMiddleCents = chargeCents;
      }
    }
    return this.prisma.order.update({
      where: { id: orderId },
      data,
    });
  }

  async setArrivedAtPickup(orderId: string, driverId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.driverId !== driverId) throw new BadRequestException('Not your order');
    if (order.status !== 'ASSIGNED')
      throw new BadRequestException('Only assigned orders can mark arrived at pickup');
    return this.prisma.order.update({
      where: { id: orderId },
      data: { arrivedAtPickupAt: new Date() },
    });
  }

  async setArrivedAtMiddle(orderId: string, driverId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.driverId !== driverId) throw new BadRequestException('Not your order');
    if (order.status !== 'IN_PROGRESS' || order.tripType !== 'ROUNDTRIP')
      throw new BadRequestException('Only in-progress roundtrip can mark arrived at second stop');
    if (!order.leftPickupAt) throw new BadRequestException('Must have left first stop first');
    return this.prisma.order.update({
      where: { id: orderId },
      data: { arrivedAtMiddleAt: new Date() },
    });
  }

  /** For roundtrip: driver leaves middle (second) stop to go to final. We don't change status; we set leftMiddleAt when they click "Start to final". */
  async setLeftMiddle(orderId: string, driverId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.driverId !== driverId) throw new BadRequestException('Not your order');
    if (order.tripType !== 'ROUNDTRIP' || !order.arrivedAtMiddleAt)
      throw new BadRequestException('Must be roundtrip and have arrived at second stop');
    const now = new Date();
    let chargeCents = 0;
    const manualMinutes = (order as any).manualWaitMiddleMinutes;
    if (manualMinutes != null && typeof manualMinutes === 'number') {
      chargeCents = getWaitChargeCentsFromTotalMinutes(manualMinutes);
    } else {
      const { chargeCents: autoCharge } = computeWaitCharge(order.arrivedAtMiddleAt!, now);
      chargeCents = autoCharge;
    }
    return this.prisma.order.update({
      where: { id: orderId },
      data: { leftMiddleAt: now, waitChargeAtMiddleCents: chargeCents },
    });
  }

  async delete(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    await this.prisma.order.delete({ where: { id: orderId } });
    return { deleted: true };
  }

  async findByDateRange(from: Date, to: Date, driverId?: string) {
    const prisma = this.prisma;
    return prisma.order.findMany({
      where: {
        pickupAt: { gte: from, lte: to },
        ...(driverId ? { driverId } : {}),
      },
      orderBy: { pickupAt: 'asc' },
      include: { passenger: true },
    });
  }

  async findLastByPhone(phone: string, limit = 10) {
    const cleaned = phone.replace(/\D/g, '');
    const conditions: any[] = [{ phone: { contains: phone } }];
    // If we have a cleaned version different from original, search for that too
    if (cleaned.length >= 7 && cleaned !== phone) {
      conditions.push({ phone: { contains: cleaned } });
    }

    return this.prisma.order.findMany({
      where: {
        passenger: {
          OR: conditions,
        },
      },
      orderBy: { pickupAt: 'desc' },
      take: limit,
      include: { passenger: true },
    });
  }

  async setWaitInfo(
    orderId: string,
    driverId: string,
    minutes: number | null,
    notes?: string,
    type: 'pickup' | 'middle' = 'pickup',
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.driverId !== driverId) throw new BadRequestException('Not your order');

    const data: any = {};
    if (type === 'pickup') {
      data.manualWaitMinutes = minutes;
      data.waitNotes = notes;
    } else {
      data.manualWaitMiddleMinutes = minutes;
      data.waitMiddleNotes = notes;
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data,
    });
  }
}
