import {
  Controller,
  Get,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from '../../app.controller';
import { AppService } from '../../app.service';
import { HttpExceptionFilter } from '../filters/http-exception.filter';
import { HttpLoggingInterceptor } from '../interceptors/http-logging.interceptor';
import {
  RequestIdMiddleware,
  type RequestWithId,
} from '../middleware/request-id.middleware';
import { REQUEST_ID_HEADER } from './request-id';

@Controller('probe-auth')
class ProbeAuthController {
  @Get('secure')
  secure() {
    throw new UnauthorizedException('No autenticado');
  }
}

describe('Observabilidad HTTP (health + requestId)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController, ProbeAuthController],
      providers: [
        AppService,
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    const requestIdMiddleware = new RequestIdMiddleware();
    app.use((req: RequestWithId, res: Response, next: NextFunction) =>
      requestIdMiddleware.use(req, res, next),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health sin token → 200 mínimo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers[REQUEST_ID_HEADER]).toBeDefined();
    expect(JSON.stringify(res.body)).not.toMatch(/password|jwt|sql|host/i);
  });

  it('health con Bearer inválido sigue 200 (público)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Authorization', 'Bearer invalid-token')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('propaga X-Request-Id válido', async () => {
    const id = 'client-req-12345';
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set(REQUEST_ID_HEADER, id)
      .expect(200);

    expect(res.headers[REQUEST_ID_HEADER]).toBe(id);
  });

  it('401 no expone secretos y incluye requestId en header', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/probe-auth/secure')
      .expect(401);

    const body = res.body as { statusCode?: number };
    expect(body.statusCode).toBe(401);
    expect(JSON.stringify(body)).not.toMatch(/password|eyJ|Bearer /i);
    expect(res.headers[REQUEST_ID_HEADER]).toBeDefined();
  });
});
