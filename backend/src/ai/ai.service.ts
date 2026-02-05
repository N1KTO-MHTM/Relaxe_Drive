import { Injectable } from '@nestjs/common';
import { GeoService } from '../geo/geo.service';
import { CostTrackerService } from '../cost-tracker/cost-tracker.service';

const AI_ETA_URL = process.env.AI_ETA_URL;

/** AI ETA prediction, predicted load, smart rerouting. Fallback to classic ETA on failure. */
@Injectable()
export class AiService {
  constructor(
    private readonly geo: GeoService,
    private readonly costTracker: CostTrackerService,
  ) {}

  async predictEta(
    orderId: string,
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<{ minutes: number | null; source: 'ai' | 'classic' }> {
    if (AI_ETA_URL) {
      this.costTracker.increment('ai');
      try {
        const res = await fetch(AI_ETA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, from, to }),
        });
        if (res.ok) {
          const data = (await res.json()) as { minutes?: number };
          if (typeof data.minutes === 'number') {
            return { minutes: data.minutes, source: 'ai' };
          }
        }
      } catch (e) {
        console.warn('[AiService] AI ETA request failed:', e);
      }
    }
    const eta = await this.geo.getEta(from, to);
    return { minutes: eta.minutes, source: 'classic' };
  }

  async getPredictedLoad(
    zone: string,
    from: Date,
    to: Date,
  ): Promise<{ level: 'low' | 'normal' | 'high'; peaks: Array<{ at: string; level: string }> }> {
    return { level: 'normal', peaks: [] };
  }
}
