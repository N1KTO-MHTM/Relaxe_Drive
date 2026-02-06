import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertsModule } from '../alerts/alerts.module';
import { CostControlModule } from '../cost-control/cost-control.module';
import { PlanningModule } from '../planning/planning.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AlertsModule,
    CostControlModule,
    PlanningModule,
    UsersModule,
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
