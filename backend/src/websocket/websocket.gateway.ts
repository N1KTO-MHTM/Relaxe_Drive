import { Inject, forwardRef } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/' })
export class RelaxDriveWsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token);
      client.data.user = payload;
      await this.usersService.updateOnline(payload.sub, true);
      this.emitUserUpdated(payload.sub);

      // Join rooms
      if (payload.role === 'DRIVER') {
        client.join('drivers');
      }
      if (payload.role === 'ADMIN' || payload.role === 'DISPATCHER') {
        client.join('dispatchers');
      }
    } catch (e) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data?.user?.sub) {
      const userId = client.data.user.sub;
      await this.usersService.updateOnline(userId, false);
      this.emitUserUpdated(userId);
    }
  }

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

  broadcastPlanning(payload: unknown) {
    this.server?.emit('planning.update', payload);
  }

  broadcastChatMessage(payload: unknown) {
    this.server?.emit('chat.message', payload);
  }

  broadcastChatRead(payload: unknown) {
    this.server?.emit('chat.read', payload);
  }

  broadcastOrderOffer(payload: unknown) {
    this.server?.emit('order.offer', payload);
  }
}
