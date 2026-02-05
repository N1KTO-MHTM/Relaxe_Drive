import { Injectable } from '@nestjs/common';

/** Reports, heatmap, filters by time/role. */
@Injectable()
export class AnalyticsService {
  async getHeatmap(from: Date, to: Date) {
    return { zones: [], counts: [] };
  }
}
