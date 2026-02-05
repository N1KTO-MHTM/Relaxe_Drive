import { Injectable } from '@nestjs/common';

/** Auto follow-ups: stopped movement, ETA rise, off-route, connection lost. Emit via WebSocket. */
@Injectable()
export class AlertsService {
  async emitAlert(type: string, payload: Record<string, unknown>) {
    // Injected WebSocket gateway will broadcast to 'alerts' channel
  }
}
