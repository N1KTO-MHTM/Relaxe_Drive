import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/' })
export class RelaxDriveWsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection() {
    // Auth via token in handshake; join channels: orders, drivers, alerts, eta
  }

  handleDisconnect() {}

  broadcastOrders(payload: unknown) {
    this.server?.emit('orders', payload);
  }

  broadcastDrivers(payload: unknown) {
    this.server?.emit('drivers', payload);
  }

  broadcastAlerts(payload: unknown) {
    this.server?.emit('alerts', payload);
  }

  broadcastEta(payload: unknown) {
    this.server?.emit('eta', payload);
  }

  /** Notify clients that a user was updated (e.g. role change) so they refetch current user */
  emitUserUpdated(userId: string) {
    this.server?.emit('user.updated', { userId });
  }

  /** New driver report (police, traffic, work zone, crash, etc.) so all drivers see it on the map */
  broadcastReport(payload: unknown) {
    this.server?.emit('report', payload);
  }
}
