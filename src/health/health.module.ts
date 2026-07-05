import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HealthController } from './health.controller';

// Imports DatabaseModule so the controller's readiness probe can inject
// DatabaseService (DatabaseModule exports it).
@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
})
export class HealthModule {}
