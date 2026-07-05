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
import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * Provides the shared Postgres/PostGIS connection pool. Exported so any feature
 * module (starting with health's readiness probe) can inject DatabaseService.
 * Later spatial-matching stories build their repositories on top of this.
 */
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
