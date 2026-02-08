import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RelaxDriveWsGateway } from './websocket.gateway';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [forwardRef(() => AuthModule), forwardRef(() => UsersModule), JwtModule],
  providers: [RelaxDriveWsGateway],
  exports: [RelaxDriveWsGateway],
})
export class WebSocketModule { }
