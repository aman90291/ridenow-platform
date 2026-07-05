import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Rider & driver web clients call the API cross-origin. Keep dev permissive,
  // but in production restrict to a configured allowlist (CORS_ORIGINS, comma-separated).
  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? (corsOrigins ?? false) : true,
  });
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  Logger.log(`RideNow API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
