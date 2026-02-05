import { Injectable } from '@nestjs/common';

/** AI ETA prediction, predicted load, smart rerouting. Fallback to classic ETA on failure. */
@Injectable()
export class AiService {
  async predictEta(orderId: string, from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
    return { minutes: null as number | null, source: 'classic' as 'ai' | 'classic' };
  }

  async getPredictedLoad(zone: string, from: Date, to: Date) {
    return { level: 'normal' as 'low' | 'normal' | 'high', peaks: [] };
  }
}
