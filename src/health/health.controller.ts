import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface HealthStatus {
  status: 'ok';
  service: string;
  timestamp: string;
  uptime: number;
}

export interface ReadinessStatus {
  status: 'ok' | 'degraded';
  db: 'ok' | 'unreachable';
  postgis?: string;
}

/**
 * Minimal shape of the HTTP response we mutate — just enough to override the
 * status code. Declared locally so the readiness probe pulls in no
 * @types/express (not a dependency of this backend).
 */
interface StatusSettableResponse {
  status(code: number): unknown;
}

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Liveness probe. Deployment platforms and CI hit GET /api/health and
   * expect a 200. Kept dependency-free so it stays green even when the
   * database is unavailable — that's what readiness is for.
   */
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
   * Readiness probe. Proves the vertical slice is wired: the db is reachable
   * AND the PostGIS extension is enabled (via SELECT postgis_version()).
   * Returns 200 { db: 'ok', postgis } when ready, or 503 { db: 'unreachable' }
   * when the ping fails, so orchestrators can gate traffic on a real check.
   */
  @Get('ready')
  async ready(
    @Res({ passthrough: true }) res: StatusSettableResponse,
  ): Promise<ReadinessStatus> {
    const ping = await this.database.ping();
    if (ping.ok) {
      return { status: 'ok', db: 'ok', postgis: ping.postgisVersion };
    }
    res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: 'degraded', db: 'unreachable' };
  }
}
