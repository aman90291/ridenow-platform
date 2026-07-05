import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';

/**
 * Root module for the RideNow API.
 *
 * The walking skeleton only wires the health module. Feature modules
 * (auth/OTP, matching, tracking, payments) are added by later stories and
 * plug in here behind their ports.
 */
@Module({
  imports: [HealthModule],
})
export class AppModule {}
