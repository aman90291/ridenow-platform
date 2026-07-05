import { Test, TestingModule } from '@nestjs/testing';
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
});
