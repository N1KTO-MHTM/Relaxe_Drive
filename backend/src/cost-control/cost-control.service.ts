import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CostTrackerService } from '../cost-tracker/cost-tracker.service';

export type CostCategory = 'maps' | 'translation' | 'ai' | 'tts';

export type CostControlResponse = {
  maps: number;
  translation: number;
  ai: number;
  tts: number;
  limits?: Partial<Record<CostCategory, number>>;
  exceeded?: Partial<Record<CostCategory, boolean>>;
};

/** Cost tracking: maps, translation, AI, TTS. Limits and alerts for admin. */
@Injectable()
export class CostControlService {
  constructor(
    private readonly tracker: CostTrackerService,
    private readonly config: ConfigService,
  ) {}

  private getLimits(): Partial<Record<CostCategory, number>> {
    const limits: Partial<Record<CostCategory, number>> = {};
    const maps = this.config.get<number>('COST_LIMIT_MAPS');
    const translation = this.config.get<number>('COST_LIMIT_TRANSLATION');
    const ai = this.config.get<number>('COST_LIMIT_AI');
    const tts = this.config.get<number>('COST_LIMIT_TTS');
    if (maps != null && !Number.isNaN(Number(maps))) limits.maps = Number(maps);
    if (translation != null && !Number.isNaN(Number(translation))) limits.translation = Number(translation);
    if (ai != null && !Number.isNaN(Number(ai))) limits.ai = Number(ai);
    if (tts != null && !Number.isNaN(Number(tts))) limits.tts = Number(tts);
    return limits;
  }

  async getCosts(_tenantId?: string): Promise<CostControlResponse> {
    const usage = this.tracker.getSnapshot();
    const limits = this.getLimits();
    const exceeded: Partial<Record<CostCategory, boolean>> = {};
    if (Object.keys(limits).length > 0) {
      (Object.keys(limits) as CostCategory[]).forEach((cat) => {
        const limit = limits[cat];
        if (limit != null && usage[cat] >= limit) exceeded[cat] = true;
      });
    }
    const out: CostControlResponse = { ...usage };
    if (Object.keys(limits).length > 0) out.limits = limits;
    if (Object.keys(exceeded).length > 0) out.exceeded = exceeded;
    return out;
  }
}
