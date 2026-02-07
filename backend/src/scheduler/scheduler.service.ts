import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { CostControlService } from '../cost-control/cost-control.service';
import { PlanningService } from '../planning/planning.service';
import { UsersService } from '../users/users.service';

/** Cron jobs: session cleanup, DriverTripSummary cleanup, pickup reminders, cost limit alert, planning, driver stats. */
@Injectable()
export class SchedulerService {
  constructor(
    private prisma: PrismaService,
    private alerts: AlertsService,
    private costControl: CostControlService,
    private config: ConfigService,
    private planning: PlanningService,
    private users: UsersService,
  ) { }

  /** Every day at 3:00 — delete sessions not active for 90 days (config: SESSION_CLEANUP_DAYS). */
  @Cron('0 3 * * *')
  async cleanupOldSessions() {
    const days = this.config.get<number>('SESSION_CLEANUP_DAYS', 90);
    const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.prisma.session.deleteMany({
      where: { lastActiveAt: { lt: before } },
    });
    if (result.count > 0) {
      // optional: log to audit or console
    }
  }

  /** Every day at 4:00 — delete DriverTripSummary older than 365 days. */
  @Cron('0 4 * * *')
  async cleanupOldTripSummaries() {
    const days = 365;
    const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.prisma.driverTripSummary.deleteMany({
      where: { completedAt: { lt: before } },
    });
    if (result.count > 0) {
      // optional: log
    }
  }

  /** Every 5 minutes — remind about pickups in the next N minutes (PICKUP_REMINDER_MINUTES, default 15). */
  @Cron('*/5 * * * *')
  async sendPickupReminders() {
    const now = new Date();
    const minutes = this.config.get<number>('PICKUP_REMINDER_MINUTES', 15);
    const windowMs = minutes * 60 * 1000;
    const windowEnd = new Date(now.getTime() + windowMs);
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: ['SCHEDULED', 'ASSIGNED'] },
        pickupAt: { gte: now, lte: windowEnd },
      },
      select: { id: true, pickupAt: true, pickupAddress: true, driverId: true },
    });
    for (const o of orders) {
      this.alerts.emitAlert('reminder_pickup_soon', {
        orderId: o.id,
        pickupAt: o.pickupAt.toISOString(),
        pickupAddress: o.pickupAddress ?? undefined,
        driverId: o.driverId ?? undefined,
      });
    }
  }

  /** Every hour — recompute DriverStats (idleAvg, lateRate, rejectRate) for all drivers. */
  @Cron('0 * * * *')
  async runDriverStats() {
    try {
      await this.users.recomputeAllDriverStats();
    } catch {
      // ignore
    }
  }

  /** Every 5 minutes — recompute planning (window, risky orders, suggested drivers) and emit planning.update. */
  @Cron('*/5 * * * *')
  async runPlanning() {
    try {
      await this.planning.recalculateAndEmit();
    } catch {
      // ignore
    }
  }

  /** Every hour — if cost limits exceeded, emit alert for admin. */
  @Cron('0 * * * *')
  async checkCostLimits() {
    try {
      const costs = await this.costControl.getCosts();
      const exceeded = costs.exceeded;
      if (exceeded && Object.keys(exceeded).length > 0) {
        const categories = Object.entries(exceeded)
          .filter(([, v]) => v)
          .map(([k]) => k);
        if (categories.length > 0) {
          this.alerts.emitAlert('cost_limit_exceeded', {
            categories,
            limits: costs.limits,
            usage: {
              maps: costs.maps,
              translation: costs.translation,
              ai: costs.ai,
              tts: costs.tts,
            },
          });
        }
      }
    } catch {
      // ignore
    }
  }
}
