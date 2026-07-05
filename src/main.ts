import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Rider & driver web clients call the API cross-origin in dev.
  app.enableCors();
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  Logger.log(`RideNow API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
