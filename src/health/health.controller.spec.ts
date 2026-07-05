import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../database/database.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let ping: jest.Mock;

  beforeEach(async () => {
    ping = jest.fn();
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DatabaseService, useValue: { ping } }],
    }).compile();

    controller = moduleRef.get<HealthController>(HealthController);
  });

  it('reports an ok status for the health check', () => {
    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('ridenow-api');
    expect(typeof result.timestamp).toBe('string');
  });

  it('reports ready with the postgis version when the db ping succeeds', async () => {
    ping.mockResolvedValue({ ok: true, postgisVersion: '3.4 USE_GEOS=1' });

    const result = await controller.ready();

    expect(result).toEqual({ status: 'ok', db: 'ok', postgis: '3.4 USE_GEOS=1' });
  });

  it('throws 503 degraded when the db ping fails', async () => {
    ping.mockResolvedValue({ ok: false });

    const err = await controller.ready().then(
      () => null,
      (e) => e,
    );

    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err.getStatus()).toBe(503);
    expect(err.getResponse()).toEqual({ status: 'degraded', db: 'unreachable' });
  });
});
