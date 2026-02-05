import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AuditModule } from '../audit/audit.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [AuditModule, OrdersModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
