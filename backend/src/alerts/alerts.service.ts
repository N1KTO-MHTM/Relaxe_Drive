import { Injectable } from '@nestjs/common';
import { RelaxDriveWsGateway } from '../websocket/websocket.gateway';

/** Emit dashboard alerts via WebSocket (order assigned, etc.). */
@Injectable()
export class AlertsService {
  constructor(private readonly ws: RelaxDriveWsGateway) {}

  emitAlert(type: string, payload: Record<string, unknown>) {
    this.ws.broadcastAlerts({ type, ...payload, at: new Date().toISOString() });
  }
}
