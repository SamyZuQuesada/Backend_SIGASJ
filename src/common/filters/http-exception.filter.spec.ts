import {
  BadRequestException,
  Controller,
  Get,
  INestApplication,
  InternalServerErrorException,
  PayloadTooLargeException,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MulterError } from 'multer';
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

  @Get('tecnico-400')
  tecnico400() {
    throw new BadRequestException(
      'QueryFailedError: INSERT INTO actividades constraint violation',
    );
  }

  @Post('multer-size')
  multerSize() {
    throw new MulterError('LIMIT_FILE_SIZE');
  }

  @Post('payload-too-large')
  payloadTooLarge() {
    throw new PayloadTooLargeException('File too large');
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

  it('sanitiza mensajes técnicos en 400 y no expone TypeORM/SQL', async () => {
    const response = await request(app.getHttpServer())
      .get('/errores-seguridad/tecnico-400')
      .expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(JSON.stringify(response.body)).not.toMatch(
      /QueryFailedError|INSERT|constraint/i,
    );
    expect(response.body.message).toBe(
      'Los datos enviados no son válidos. Revise la información e intente nuevamente.',
    );
  });

  it('mapea Multer LIMIT_FILE_SIZE a 400 en español', async () => {
    const response = await request(app.getHttpServer())
      .post('/errores-seguridad/multer-size')
      .expect(400);

    expect(response.body).toEqual({
      statusCode: 400,
      message: 'El archivo no puede superar 10 MB.',
    });
  });

  it('mapea PayloadTooLargeException a 400 en español', async () => {
    const response = await request(app.getHttpServer())
      .post('/errores-seguridad/payload-too-large')
      .expect(400);

    expect(response.body).toEqual({
      statusCode: 400,
      message: 'El archivo no puede superar 10 MB.',
    });
  });
});
