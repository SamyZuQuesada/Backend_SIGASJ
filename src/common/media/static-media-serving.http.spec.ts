import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Controller, Get, Module } from '@nestjs/common';
import request from 'supertest';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

@Controller()
class DummyController {
  @Get('dummy')
  getDummy() {
    return { ok: true };
  }
}

@Module({
  controllers: [DummyController],
})
class DummyAppModule {}

describe('Static Assets Serving e2e tests', () => {
  let app: NestExpressApplication;
  const uploadDir = join(process.cwd(), 'uploads');
  const sampleJpegBase64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  beforeAll(async () => {
    // Asegurar archivos físicos
    const sampleImages = [
      join(uploadDir, 'galeria', 'tanque.jpg'),
      join(uploadDir, 'galeria', 'oficina.jpg'),
      join(uploadDir, 'comunicados', 'aviso.jpg'),
    ];
    for (const img of sampleImages) {
      mkdirSync(join(img, '..'), { recursive: true });
      if (!existsSync(img)) {
        writeFileSync(img, Buffer.from(sampleJpegBase64, 'base64'));
      }
    }

    const moduleRef = await Test.createTestingModule({
      imports: [DummyAppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();

    app.enableCors({
      origin: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    });

    app.useStaticAssets(uploadDir, {
      prefix: '/uploads/',
      setHeaders: (res: { setHeader(name: string, value: string): void }) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    });

    app.useStaticAssets(uploadDir, {
      prefix: '/api/v1/uploads/',
      setHeaders: (res: { setHeader(name: string, value: string): void }) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /uploads/galeria/tanque.jpg responde con 200, Content-Type image/jpeg y CORS', async () => {
    const res = await request(app.getHttpServer())
      .get('/uploads/galeria/tanque.jpg')
      .set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('GET /uploads/comunicados/aviso.jpg responde con 200, Content-Type image/jpeg y CORS', async () => {
    const res = await request(app.getHttpServer())
      .get('/uploads/comunicados/aviso.jpg')
      .set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('GET /api/v1/uploads/galeria/tanque.jpg responde con 200 por alias', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/uploads/galeria/tanque.jpg',
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
  });

  it('GET /api/v1/uploads/comunicados/aviso.jpg responde con 200 por alias', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/uploads/comunicados/aviso.jpg',
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
  });

  it('GET /uploads/galeria/no-existe.jpg responde con 404', async () => {
    const res = await request(app.getHttpServer()).get(
      '/uploads/galeria/no-existe.jpg',
    );

    expect(res.status).toBe(404);
  });
});
