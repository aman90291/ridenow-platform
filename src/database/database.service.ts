import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

export interface PingResult {
  ok: boolean;
  postgisVersion: string;
}

/**
 * Thin wrapper around the shared PostgreSQL/PostGIS connection pool.
 *
 * `ping()` backs the readiness probe: it round-trips to the database and
 * confirms the PostGIS extension is available, since the geospatial matching
 * and tracking slices depend on it.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  async ping(): Promise<PingResult> {
    const result = await this.pool.query<{ postgis_version: string }>(
      'SELECT postgis_version() AS postgis_version',
    );
    return { ok: true, postgisVersion: result.rows[0].postgis_version };
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

/** Result of a readiness ping against Postgres/PostGIS. */
export interface DbPing {
  ok: boolean;
  postgisVersion?: string;
}

// A readiness ping must fail fast rather than hang a health probe when the
// database is unreachable or overloaded. Bound both the connection attempt and
// the query itself to a small, fixed budget (mirrors the DB-ping-with-timeout
// health pattern from SCRUM-170).
const PING_TIMEOUT_MS = 2000;

/**
 * Owns the single pg connection pool for the API. Config comes entirely from
 * process.env.DATABASE_URL (no secrets literalized here); the URL points at the
 * `db` service inside compose and at localhost for local `npm run start:dev`.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Cap how long a brand-new connection may take so a down db surfaces as a
      // fast 503 instead of a hung request.
      connectionTimeoutMillis: PING_TIMEOUT_MS,
      statement_timeout: PING_TIMEOUT_MS,
      query_timeout: PING_TIMEOUT_MS,
    });

    // A pool-level error (e.g. an idle backend dropped) must not crash the
    // process; log it and let the next ping re-establish a connection.
    this.pool.on('error', (err) => {
      this.logger.error(`pg pool error: ${err.message}`);
    });
  }

  /**
   * Readiness check: proves the db is reachable AND that the PostGIS extension
   * is installed by asking Postgres for the PostGIS version. Never throws — a
   * failure is reported as { ok: false } so the controller can map it to 503.
   */
  async ping(): Promise<DbPing> {
    try {
      const result = await this.pool.query(
        'SELECT postgis_version() AS postgis_version',
      );
      const postgisVersion: string | undefined = result.rows[0]?.postgis_version;
      return { ok: Boolean(postgisVersion), postgisVersion };
    } catch (err) {
      this.logger.warn(
        `db readiness ping failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { ok: false };
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
