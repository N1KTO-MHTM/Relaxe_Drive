import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UsersModule } from '../users/users.module';
import { GeoModule } from '../geo/geo.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { PlanningService } from './planning.service';
import { PlanningController } from './planning.controller';

@Module({
  imports: [EventEmitterModule, UsersModule, GeoModule, WebSocketModule],
  controllers: [PlanningController],
  providers: [PlanningService],
  exports: [PlanningService],
})
export class PlanningModule {}
