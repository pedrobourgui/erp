import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('GET /health', () => {
    it('should return status ok with timestamp and uptime', () => {
      const result = controller.check();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return a valid ISO timestamp', () => {
      const result = controller.check();

      expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
    });

    it('should have @Public() decorator', () => {
      const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, controller.check);
      expect(metadata).toBe(true);
    });
  });
});
