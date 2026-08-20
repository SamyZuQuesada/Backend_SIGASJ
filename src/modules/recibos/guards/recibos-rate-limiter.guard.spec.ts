import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { RecibosRateLimiterGuard } from './recibos-rate-limiter.guard';

describe('RecibosRateLimiterGuard', () => {
  let guard: RecibosRateLimiterGuard;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'acueductosCr.rateLimitWindowMs') return 60000;
      if (key === 'acueductosCr.rateLimitMax') return 3;
      return null;
    }),
  };

  const createMockContext = (ip: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          ip,
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecibosRateLimiterGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    guard = module.get<RecibosRateLimiterGuard>(RecibosRateLimiterGuard);
  });

  it('debe permitir solicitudes por debajo del límite máximo de rate limiting', () => {
    const context = createMockContext('192.168.1.100');

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('debe lanzar 429 Too Many Requests cuando se excede el límite máximo', () => {
    const context = createMockContext('192.168.1.101');

    guard.canActivate(context); // 1
    guard.canActivate(context); // 2
    guard.canActivate(context); // 3

    expect(() => guard.canActivate(context)).toThrow(HttpException);

    try {
      guard.canActivate(context);
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });
});
