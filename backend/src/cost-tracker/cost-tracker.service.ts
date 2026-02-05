import { Injectable } from '@nestjs/common';

export type CostCategory = 'maps' | 'translation' | 'ai' | 'tts';

/** In-memory usage counters for external API calls. CostControlService reads these. */
@Injectable()
export class CostTrackerService {
  private readonly counts: Record<CostCategory, number> = {
    maps: 0,
    translation: 0,
    ai: 0,
    tts: 0,
  };

  increment(category: CostCategory) {
    this.counts[category]++;
  }

  getSnapshot(): Record<CostCategory, number> {
    return { ...this.counts };
  }
}
