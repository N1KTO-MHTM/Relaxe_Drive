import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
// Version 1.0.1 - Redesigned UI & Fixed Login Logic
import { logger } from './common/logger';
import { AllExceptionsFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = new DocumentBuilder()
    .setTitle('RelaxDrive API')
    .setDescription('Dispatch control center API — orders, users, drivers, reports, audit, health.')
    .setVersion('1.2')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (corsOrigins.includes(origin) || origin === 'null') return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.info('API listening', 'Bootstrap', { port });
}

bootstrap().catch((err) => {
  logger.error('Bootstrap failed', 'Bootstrap', { err: String(err) });
  process.exit(1);
});
