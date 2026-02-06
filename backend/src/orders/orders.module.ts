import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AuditModule } from '../audit/audit.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { AlertsModule } from '../alerts/alerts.module';
import { GeoModule } from '../geo/geo.module';
import { UsersModule } from '../users/users.module';
import { PassengersModule } from '../passengers/passengers.module';
import { PlanningModule } from '../planning/planning.module';

@Module({
  imports: [AuditModule, WebSocketModule, AlertsModule, GeoModule, UsersModule, PassengersModule, PlanningModule],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
