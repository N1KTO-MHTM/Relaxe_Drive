import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { GeoService } from '../geo/geo.service';
import { RelaxDriveWsGateway } from '../websocket/websocket.gateway';

const PLAN_WINDOW_MINUTES = 60;
const FAR_DRIVER_ETA_MINUTES = 25;
const MAX_SUGGESTED_DRIVERS = 5;

export interface RiskyOrder {
  orderId: string;
  pickupAt: string;
  reason: 'NO_DRIVER' | 'LATE_FINISH' | 'FAR_DRIVER';
  suggestedDrivers: string[];
}

export interface OrderPlanningRow {
  orderId: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedDriverId: string | null;
}

export interface PlanningResult {
  windowStart: string;
  windowEnd: string;
  ordersCount: number;
  driversAvailable: number;
  shortage: boolean;
  riskyOrders: RiskyOrder[];
  orderRows: OrderPlanningRow[];
}

interface DriverEtaRow {
  id: string;
  etaMinutesToPickup: number;
  etaMinutesTotal: number;
}

@Injectable()
export class PlanningService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private geo: GeoService,
    private ws: RelaxDriveWsGateway,
    private eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    this.eventEmitter.on('planning.recalculate', () => {
      this.recalculateAndEmit().catch(() => {});
    });
  }

  /**
   * Recompute planning for the next PLAN_WINDOW_MINUTES and emit planning.update.
   * Safe: does not assign drivers; only updates riskLevel and suggestedDriverId on orders.
   */
  async recalculateAndEmit(): Promise<PlanningResult> {
    const result = await this.getPlanningResult(PLAN_WINDOW_MINUTES);
    await this.persistRiskAndSuggestions(result);
    this.ws.broadcastPlanning(result);
    return result;
  }

  /** Get planning result for the next windowMinutes. Does not persist or emit. */
  async getPlanningResult(windowMinutes: number = PLAN_WINDOW_MINUTES): Promise<PlanningResult> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowMinutes * 60 * 1000);
    const windowStart = now.toISOString();
    const windowEndStr = windowEnd.toISOString();

    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: ['SCHEDULED', 'ASSIGNED'] },
        pickupAt: { gte: now, lte: windowEnd },
      },
      orderBy: { pickupAt: 'asc' },
      include: { passenger: true },
    });

    const allDrivers = await this.usersService.findAll();
    const drivers = allDrivers.filter(
      (u) =>
        u.role === 'DRIVER' &&
        u.available !== false &&
        !(u as { blocked?: boolean }).blocked &&
        (!(u as { bannedUntil?: Date | null }).bannedUntil ||
          (u as { bannedUntil?: Date | null }).bannedUntil! <= now) &&
        (u as { lat?: number | null }).lat != null &&
        (u as { lng?: number | null }).lng != null &&
        Number.isFinite((u as { lat?: number }).lat) &&
        Number.isFinite((u as { lng?: number }).lng),
    );

    const riskyOrders: RiskyOrder[] = [];
    const orderRows: OrderPlanningRow[] = [];

    for (const order of orders) {
      const pickupCoords = await this.geo.geocode(order.pickupAddress);
      const dropoffCoords = await this.geo.geocode(order.dropoffAddress);
      let driverList = drivers;
      const preferred = order.preferredCarType?.trim()?.toUpperCase();
      if (preferred) {
        driverList = driverList.filter(
          (d) => (d as { carType?: string | null }).carType === preferred,
        );
      }
      const etaRows: DriverEtaRow[] = [];
      if (pickupCoords && dropoffCoords) {
        for (const d of driverList) {
          const lat = (d as { lat: number }).lat!;
          const lng = (d as { lng: number }).lng!;
          const toPickup = await this.geo.getEta({ lat, lng }, pickupCoords);
          const pickupToDrop = await this.geo.getEta(pickupCoords, dropoffCoords);
          etaRows.push({
            id: d.id,
            etaMinutesToPickup: Math.round(toPickup.minutes * 10) / 10,
            etaMinutesTotal: Math.round((toPickup.minutes + pickupToDrop.minutes) * 10) / 10,
          });
        }
        etaRows.sort((a, b) => a.etaMinutesToPickup - b.etaMinutesToPickup);
      }
      const manual = !!(order as { manualAssignment?: boolean }).manualAssignment;
      const suggestedDrivers = etaRows.slice(0, MAX_SUGGESTED_DRIVERS).map((r) => r.id);
      const suggestedDriverId = manual ? null : (suggestedDrivers[0] ?? null);

      let reason: RiskyOrder['reason'] | null = null;
      if (!manual) {
        if (etaRows.length === 0) {
          reason = 'NO_DRIVER';
        } else if (etaRows[0].etaMinutesToPickup > FAR_DRIVER_ETA_MINUTES) {
          reason = 'FAR_DRIVER';
        }
        if (order.driverId) {
          const assignedEta = etaRows.find((r) => r.id === order.driverId);
          if (assignedEta && assignedEta.etaMinutesToPickup > FAR_DRIVER_ETA_MINUTES) {
            reason = 'FAR_DRIVER';
          }
        }
      }
      const riskLevel: OrderPlanningRow['riskLevel'] =
        manual ? 'LOW' : (reason === 'NO_DRIVER' ? 'HIGH' : reason === 'FAR_DRIVER' ? 'MEDIUM' : 'LOW');
      orderRows.push({ orderId: order.id, riskLevel, suggestedDriverId });
      if (reason) {
        riskyOrders.push({
          orderId: order.id,
          pickupAt: order.pickupAt.toISOString(),
          reason,
          suggestedDrivers,
        });
      }
    }

    const unassignedCount = orders.filter((o) => !o.driverId).length;
    const shortage = unassignedCount > 0 && drivers.length < unassignedCount;

    return {
      windowStart,
      windowEnd: windowEndStr,
      ordersCount: orders.length,
      driversAvailable: drivers.length,
      shortage,
      riskyOrders,
      orderRows,
    };
  }

  /** Problem zones for heatmap: late pickups and cancelled orders (last daysDays). */
  async getProblemZones(daysDays: number): Promise<{ late: { lat: number; lng: number }[]; cancelled: { lat: number; lng: number }[] }> {
    const since = new Date(Date.now() - daysDays * 24 * 60 * 60 * 1000);
    const orders = await this.prisma.order.findMany({
      where: {
        OR: [
          { status: 'CANCELLED', updatedAt: { gte: since } },
          {
            status: 'COMPLETED',
            arrivedAtPickupAt: { not: null },
            updatedAt: { gte: since },
          },
        ],
      },
      select: { id: true, status: true, pickupAt: true, arrivedAtPickupAt: true, bufferMinutes: true, pickupAddress: true },
    });
    const late: { lat: number; lng: number }[] = [];
    const cancelled: { lat: number; lng: number }[] = [];
    for (const o of orders) {
      const coords = await this.geo.geocode(o.pickupAddress);
      if (!coords?.lat || !coords?.lng) continue;
      if (o.status === 'CANCELLED') {
        cancelled.push({ lat: coords.lat, lng: coords.lng });
      } else if (o.arrivedAtPickupAt) {
        const bufferMs = (o.bufferMinutes ?? 15) * 60 * 1000;
        if (o.arrivedAtPickupAt.getTime() > o.pickupAt.getTime() + bufferMs) {
          late.push({ lat: coords.lat, lng: coords.lng });
        }
      }
    }
    return { late, cancelled };
  }

  /** Return pickup coords for orders in the next windowMinutes (for map future overlay). */
  async getOrderCoords(windowMinutes: number): Promise<{ orderId: string; pickupAt: string; pickupLat: number; pickupLng: number }[]> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowMinutes * 60 * 1000);
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: ['SCHEDULED', 'ASSIGNED'] },
        pickupAt: { gte: now, lte: windowEnd },
      },
      select: { id: true, pickupAt: true, pickupAddress: true },
    });
    const out: { orderId: string; pickupAt: string; pickupLat: number; pickupLng: number }[] = [];
    for (const o of orders) {
      const coords = await this.geo.geocode(o.pickupAddress);
      if (coords?.lat != null && coords?.lng != null) {
        out.push({
          orderId: o.id,
          pickupAt: o.pickupAt.toISOString(),
          pickupLat: coords.lat,
          pickupLng: coords.lng,
        });
      }
    }
    return out;
  }

  /** Persist riskLevel and suggestedDriverId on orders from planning result. */
  private async persistRiskAndSuggestions(result: PlanningResult): Promise<void> {
    for (const row of result.orderRows) {
      await this.prisma.order.update({
        where: { id: row.orderId },
        data: { riskLevel: row.riskLevel, suggestedDriverId: row.suggestedDriverId },
      });
    }
  }
}
