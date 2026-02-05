import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { OrdersService } from '../orders/orders.service';

export type AnalyticsStats = {
  ordersCreated: number;
  ordersCompleted: number;
  byStatus: { SCHEDULED: number; ASSIGNED: number; IN_PROGRESS: number };
  heatmap: { zone: string; count: number }[];
};

/** Reports, heatmap, filters by time/role. Uses audit logs and current orders. */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly audit: AuditService,
    private readonly orders: OrdersService,
  ) {}

  async getStats(from: Date, to: Date): Promise<AnalyticsStats> {
    const [auditLogs, ordersInRange] = await Promise.all([
      this.audit.find({ resource: 'order', from, to }, 10_000),
      this.orders.findByDateRange(from, to),
    ]);

    let ordersCreated = 0;
    let ordersCompleted = 0;
    const heatmapCount: Record<string, number> = {};

    for (const log of auditLogs) {
      const d = log.createdAt;
      const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
      const hour = d.getHours();
      const key = `${day} ${hour.toString().padStart(2, '0')}`;
      heatmapCount[key] = (heatmapCount[key] ?? 0) + 1;

      if (log.action === 'order.create') ordersCreated++;
      if (log.action === 'order.status_change') {
        try {
          const p = log.payload ? JSON.parse(log.payload as string) : {};
          if (p.status === 'COMPLETED') ordersCompleted++;
        } catch {
          // ignore
        }
      }
    }

    const byStatus = { SCHEDULED: 0, ASSIGNED: 0, IN_PROGRESS: 0 };
    for (const o of ordersInRange) {
      if (o.status in byStatus) (byStatus as Record<string, number>)[o.status]++;
    }

    const heatmap = Object.entries(heatmapCount)
      .map(([zone, count]) => ({ zone, count }))
      .sort((a, b) => a.zone.localeCompare(b.zone));

    return { ordersCreated, ordersCompleted, byStatus, heatmap };
  }

  async getHeatmap(from: Date, to: Date) {
    const { heatmap } = await this.getStats(from, to);
    return { zones: heatmap.map((h) => h.zone), counts: heatmap.map((h) => h.count) };
  }
}
