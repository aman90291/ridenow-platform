import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * Owns the database connection pool and exposes `DatabaseService` to feature
 * modules (currently the health/readiness slice).
 */
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
