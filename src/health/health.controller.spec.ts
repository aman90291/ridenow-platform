import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { HealthController } from './health.controller';
import { DatabaseService } from '../database/database.service';

describe('HealthController', () => {
  let controller: HealthController;
  let ping: jest.Mock;

  // A lightweight response double: `ready()` only ever calls res.status(code),
  // and we assert against that call.
  function mockResponse(): { res: { status: jest.Mock }; status: jest.Mock } {
    const status = jest.fn().mockReturnThis();
    return { res: { status }, status };
  }

  beforeEach(async () => {
    ping = jest.fn();
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DatabaseService, useValue: { ping } }],
    }).compile();

    controller = moduleRef.get<HealthController>(HealthController);
  });

  describe('check (liveness)', () => {
    it('reports an ok status without touching the database', () => {
      const result = controller.check();

      expect(result.status).toBe('ok');
      expect(result.service).toBe('ridenow-api');
      expect(typeof result.timestamp).toBe('string');
      expect(typeof result.uptime).toBe('number');
      // Liveness must stay green independent of the db.
      expect(ping).not.toHaveBeenCalled();
    });
  });

  describe('ready (readiness)', () => {
    it('returns 200 with db ok and the postgis version when the ping succeeds', async () => {
      ping.mockResolvedValue({
        ok: true,
        postgisVersion: '3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1',
      });
      const { res, status } = mockResponse();

      const result = await controller.ready(res);

      expect(result).toEqual({
        status: 'ok',
        db: 'ok',
        postgis: '3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1',
      });
      // Success path leaves the default 200 status untouched.
      expect(status).not.toHaveBeenCalled();
    });

    it('returns 503 degraded / db unreachable when the ping fails', async () => {
      ping.mockResolvedValue({ ok: false });
      const { res, status } = mockResponse();

      const result = await controller.ready(res);

      expect(status).toHaveBeenCalledWith(503);
      expect(result).toEqual({ status: 'degraded', db: 'unreachable' });
      expect(result.postgis).toBeUndefined();
    });
  });

  // Integration coverage that boots the real Nest app and drives the routes
  // through the full HTTP stack (routing, the global `/api` prefix from main.ts,
  // JSON serialization, and the passthrough status override) — none of which the
  // direct controller calls above exercise. DatabaseService is still doubled so
  // this runs in the plain `npm test` job with no Docker/Postgres dependency.
  describe('HTTP integration (readiness + liveness through the full stack)', () => {
    let app: INestApplication;
    let httpPing: jest.Mock;

    beforeAll(async () => {
      httpPing = jest.fn();
      const moduleRef: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [{ provide: DatabaseService, useValue: { ping: httpPing } }],
      }).compile();

      app = moduleRef.createNestApplication();
      // Mirror the global prefix applied in main.ts so the real route is `/api/health/*`.
      app.setGlobalPrefix('api');
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    afterEach(() => {
      httpPing.mockReset();
    });

    it('GET /api/health/ready -> 200 application/json with db ok + postgis version', async () => {
      httpPing.mockResolvedValue({
        ok: true,
        postgisVersion: '3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1',
      });

      const response = await request(app.getHttpServer())
        .get('/api/health/ready')
        .expect(200)
        .expect('Content-Type', /application\/json/);

      expect(response.body).toEqual({
        status: 'ok',
        db: 'ok',
        postgis: '3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1',
      });
    });

    it('GET /api/health/ready -> 503 application/json when the ping fails', async () => {
      httpPing.mockResolvedValue({ ok: false });

      const response = await request(app.getHttpServer())
        .get('/api/health/ready')
        .expect(503)
        .expect('Content-Type', /application\/json/);

      expect(response.body).toEqual({ status: 'degraded', db: 'unreachable' });
    });

    it('GET /api/health -> 200 application/json liveness without touching the db', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect('Content-Type', /application\/json/);

      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('ridenow-api');
      expect(typeof response.body.timestamp).toBe('string');
      expect(typeof response.body.uptime).toBe('number');
      expect(httpPing).not.toHaveBeenCalled();
    });
  });
});
