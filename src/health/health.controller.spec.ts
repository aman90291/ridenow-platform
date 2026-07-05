import { Test, TestingModule } from '@nestjs/testing';
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
