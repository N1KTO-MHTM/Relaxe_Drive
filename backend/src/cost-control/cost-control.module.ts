import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CostTrackerModule } from '../cost-tracker/cost-tracker.module';
import { CostControlService } from './cost-control.service';
import { CostControlController } from './cost-control.controller';

@Module({
  imports: [ConfigModule, CostTrackerModule],
  providers: [CostControlService],
  controllers: [CostControlController],
  exports: [CostControlService],
})
export class CostControlModule {}
