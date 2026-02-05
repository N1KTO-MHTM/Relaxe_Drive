import { Module } from '@nestjs/common';
import { CostControlService } from './cost-control.service';

@Module({
  providers: [CostControlService],
  exports: [CostControlService],
})
export class CostControlModule {}
