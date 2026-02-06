import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertsModule } from '../alerts/alerts.module';
import { CostControlModule } from '../cost-control/cost-control.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AlertsModule,
    CostControlModule,
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
