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
}
