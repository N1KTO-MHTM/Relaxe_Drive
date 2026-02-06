import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { DriversModule } from './drivers/drivers.module';
import { GeoModule } from './geo/geo.module';
import { AiModule } from './ai/ai.module';
import { AlertsModule } from './alerts/alerts.module';
import { TranslationModule } from './translation/translation.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { CostControlModule } from './cost-control/cost-control.module';
import { CostTrackerModule } from './cost-tracker/cost-tracker.module';
import { WhiteLabelModule } from './white-label/white-label.module';
import { WebSocketModule } from './websocket/websocket.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { PassengersModule } from './passengers/passengers.module';
import { ReportsModule } from './reports/reports.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { PlanningModule } from './planning/planning.module';

@Module({
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    CostTrackerModule,
    AuthModule,
    UsersModule,
    OrdersModule,
    PassengersModule,
    DriversModule,
    GeoModule,
    AiModule,
    AlertsModule,
    TranslationModule,
    AnalyticsModule,
    AuditModule,
    CostControlModule,
    WhiteLabelModule,
    WebSocketModule,
    HealthModule,
    ReportsModule,
    SchedulerModule,
    PlanningModule,
  ],
})
export class AppModule {}
