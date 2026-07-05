import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = moduleRef.get<HealthController>(HealthController);
  });

  it('reports an ok status for the health check', () => {
    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('ridenow-api');
    expect(typeof result.timestamp).toBe('string');
  });
});

describe('GET /api/health (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    app = moduleRef.createNestApplication();
    // Mirror the global prefix configured in main.ts so the public route
    // resolves at /api/health exactly as it does in production.
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 and JSON for the public health route', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect('Content-Type', /application\/json/)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
      });
  });
});
