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

  // Harden the underlying Node HTTP server against slow-header / slow-body
  // (Slowloris) clients before any body-accepting rider/driver routes land.
  // These bound how long a single connection may hold a socket open:
  //   headersTimeout  — max time to receive the complete request headers
  //   requestTimeout  — max time to receive the complete request (headers+body)
  //   keepAliveTimeout— how long an idle keep-alive socket is kept open
  // requestTimeout must be >= headersTimeout, and keepAliveTimeout should be
  // <= headersTimeout so idle sockets close before the header deadline fires.
  const httpServer = app.getHttpServer();
  httpServer.headersTimeout = 15_000;
  httpServer.requestTimeout = 20_000;
  httpServer.keepAliveTimeout = 10_000;

  Logger.log(`RideNow API listening on http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap().catch((err) => {
  Logger.error(err, 'Bootstrap');
  process.exit(1);
});
