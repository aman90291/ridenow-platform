import { Controller, Get } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
  service: string;
  timestamp: string;
  uptime: number;
}

/**
 * Liveness probe. Deployment platforms and CI hit GET /api/health and
 * expect a 200. Kept dependency-free so it stays green before any feature
 * modules (db, integrations) exist.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthStatus {
    return {
      status: 'ok',
      service: 'ridenow-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
