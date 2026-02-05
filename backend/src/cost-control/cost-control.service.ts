import { Injectable } from '@nestjs/common';
import { CostTrackerService } from '../cost-tracker/cost-tracker.service';

/** Cost tracking: maps, translation, AI, TTS. Limits and alerts for admin. */
@Injectable()
export class CostControlService {
  constructor(private readonly tracker: CostTrackerService) {}

  async getCosts(_tenantId?: string) {
    return this.tracker.getSnapshot();
  }
}
