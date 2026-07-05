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

  // Harden the underlying Node HTTP server (the team's http.Server-timeout
  // standing order, translated from Go to the Express server behind Nest).
  // Bounding header/body/keep-alive time closes slow-header and slow-body
  // (Slowloris) exposure before any body-accepting rider/driver routes land.
  // Ordering keepAlive < headers < request avoids closing a keep-alive socket
  // mid-parse while still capping total request time.
  const server = app.getHttpServer();
  server.keepAliveTimeout = 10_000;
  server.headersTimeout = 15_000;
  server.requestTimeout = 20_000;

  Logger.log(`RideNow API listening on http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap().catch((err) => {
  Logger.error(err, 'Bootstrap');
  process.exit(1);
});
