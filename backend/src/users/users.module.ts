import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuditModule } from '../audit/audit.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { PassengersModule } from '../passengers/passengers.module';

@Module({
  imports: [AuditModule, forwardRef(() => WebSocketModule), PassengersModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule { }
