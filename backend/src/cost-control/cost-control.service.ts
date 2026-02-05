import { Injectable } from '@nestjs/common';

/** Cost tracking: maps, translation, AI, TTS. Limits and alerts for admin. */
@Injectable()
export class CostControlService {
  async getCosts(tenantId?: string) {
    return { maps: 0, translation: 0, ai: 0, tts: 0 };
  }
}
