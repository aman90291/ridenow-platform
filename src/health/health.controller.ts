import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface HealthStatus {
  status: 'ok';
  service: string;
  timestamp: string;
  uptime: number;
}

export interface ReadyStatus {
  status: 'ok';
  db: 'ok';
  postgis?: string;
}

/**
 * Liveness probe. Deployment platforms and CI hit GET /api/health and
 * expect a 200. Kept dependency-free so it stays green before any feature
 * modules (db, integrations) exist.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  check(): HealthStatus {
    return {
      status: 'ok',
      service: 'ridenow-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Readiness probe. Unlike liveness, this asserts the vertical slice is wired:
   * the db is reachable and PostGIS is enabled. Returns 200 with the PostGIS
   * version when healthy; when the db is unreachable it throws a 503 carrying
   * { status:'degraded', db:'unreachable' } so orchestrators hold traffic until
   * the database is actually usable.
   */
  @Get('ready')
  async ready(): Promise<ReadyStatus> {
    const ping = await this.db.ping();

    if (!ping.ok) {
      throw new ServiceUnavailableException({
        status: 'degraded',
        db: 'unreachable',
      });
    }

    return { status: 'ok', db: 'ok', postgis: ping.postgisVersion };
  }
}
