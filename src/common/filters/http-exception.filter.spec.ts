import {
  Controller,
  Get,
  INestApplication,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpExceptionFilter } from './http-exception.filter';

@Controller('errores-seguridad')
class ErroresSeguridadController {
  @Get('interno')
  interno() {
    throw new InternalServerErrorException(
      'SELECT * FROM Usuario WHERE password = secret',
    );
  }

  @Get('no-http')
  noHttp() {
    throw new Error('jwt expired token=eyJhbGciOi stack at QueryFailedError');
  }
}

describe('HttpExceptionFilter', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ErroresSeguridadController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('no expone stack, SQL ni secretos en errores HTTP internos', async () => {
    const response = await request(app.getHttpServer())
      .get('/errores-seguridad/interno')
      .expect(500);

    expect(response.body).toEqual({
      statusCode: 500,
      message: 'Error interno del servidor',
    });
    expect(response.body).not.toHaveProperty('stack');
    expect(JSON.stringify(response.body)).not.toMatch(/SELECT|password/i);
  });

  it('errores no HTTP se responden 500 genérico sin JWT ni SQL', async () => {
    const response = await request(app.getHttpServer())
      .get('/errores-seguridad/no-http')
      .expect(500);

    expect(response.body).toEqual({
      statusCode: 500,
      message: 'Error interno del servidor',
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(/jwt|eyJ|password|SELECT|stack/i);
  });
});
