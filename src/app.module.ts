import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

/**
 * Root module for the RideNow API.
 *
 * The walking skeleton wires the database pool and the health module. Feature
 * modules (auth/OTP, matching, tracking, payments) are added by later stories
 * and plug in here behind their ports.
 */
@Module({
  imports: [DatabaseModule, HealthModule],
})
export class AppModule {}
