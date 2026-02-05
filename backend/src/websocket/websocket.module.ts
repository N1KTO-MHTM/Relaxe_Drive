import { Module } from '@nestjs/common';
import { RelaxDriveWsGateway } from './websocket.gateway';

@Module({
  providers: [RelaxDriveWsGateway],
  exports: [RelaxDriveWsGateway],
})
export class WebSocketModule {}
