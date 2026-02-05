import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [WebSocketModule],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
