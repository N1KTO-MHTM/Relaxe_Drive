import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AuditModule } from '../audit/audit.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [AuditModule, WebSocketModule],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
