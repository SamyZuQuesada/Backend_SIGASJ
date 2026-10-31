import { INestApplication, Controller, Get, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  CORS_ALLOWED_HEADERS,
  CORS_METHODS,
  createCorsOriginDelegate,
} from '../src/config/cors-origin';

@Controller('probe')
class ProbeController {
  @Get()
  ok() {
    return { ok: true };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('CORS allowlist (e2e aislado)', () => {
  let app: INestApplication;
  const authorized = 'https://frontend-autorizado.example';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = authorized;

    const moduleRef = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableCors({
      origin: createCorsOriginDelegate({
        NODE_ENV: 'production',
        FRONTEND_URL: authorized,
      }),
      methods: [...CORS_METHODS],
      allowedHeaders: [...CORS_ALLOWED_HEADERS],
      credentials: false,
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('preflight desde origen autorizado incluye ACAO', async () => {
    const res = await request(app.getHttpServer())
      .options('/probe')
      .set('Origin', authorized)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.headers['access-control-allow-origin']).toBe(authorized);
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('request desde origen autorizado incluye ACAO', async () => {
    const res = await request(app.getHttpServer())
      .get('/probe')
      .set('Origin', authorized);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(authorized);
  });

  it('origen no autorizado no recibe ACAO válido', async () => {
    const res = await request(app.getHttpServer())
      .get('/probe')
      .set('Origin', 'https://example.com');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
