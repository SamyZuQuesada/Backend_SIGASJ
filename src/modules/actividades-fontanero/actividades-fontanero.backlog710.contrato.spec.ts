import {
  BadRequestException,
  Controller,
  Get,
  INestApplication,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { ACTIVIDADES_MSG } from './actividades-fontanero.messages';

@Controller('backlog-710-contrato')
class Backlog710ContratoController {
  @Get('ok')
  ok() {
    return { id: 1, titulo: 'Actividad de prueba' };
  }

  @Get('validacion')
  validacion() {
    throw new BadRequestException([
      'La fecha de la actividad no puede ser futura',
      'El título de la actividad es obligatorio',
    ]);
  }

  @Get('tecnico')
  tecnico() {
    throw new BadRequestException(
      'QueryFailedError TypeORM SQL Exception INSERT INTO ActividadFontanero',
    );
  }

  @Get('interno')
  interno() {
    throw new InternalServerErrorException(
      'driverError stack SELECT * FROM ActividadFontanero',
    );
  }
}

/**
 * Backlog 7.10 — contrato de respuestas (sin envelope success/data).
 */
describe('Backlog 7.10 — contrato HTTP actividades', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [Backlog710ContratoController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('éxito devuelve payload plano sin envelope success/message/data', async () => {
    const response = await request(app.getHttpServer())
      .get('/backlog-710-contrato/ok')
      .expect(200);

    expect(response.body).toEqual({ id: 1, titulo: 'Actividad de prueba' });
    expect(response.body).not.toHaveProperty('success');
    expect(response.body).not.toHaveProperty('data');
  });

  it('400 expone message como array usable por el Frontend', async () => {
    const response = await request(app.getHttpServer())
      .get('/backlog-710-contrato/validacion')
      .expect(400);

    expect(response.body).toEqual({
      statusCode: 400,
      message: [
        'La fecha de la actividad no puede ser futura',
        'El título de la actividad es obligatorio',
      ],
    });
  });

  it('sanitiza QueryFailedError/TypeORM en 400 y 500', async () => {
    const bad = await request(app.getHttpServer())
      .get('/backlog-710-contrato/tecnico')
      .expect(400);
    expect(bad.body.message).toBe(ACTIVIDADES_MSG.validacionGenerica);
    expect(JSON.stringify(bad.body)).not.toMatch(
      /QueryFailedError|TypeORM|INSERT|SQL/i,
    );

    const internal = await request(app.getHttpServer())
      .get('/backlog-710-contrato/interno')
      .expect(500);
    expect(internal.body).toEqual({
      statusCode: 500,
      message: ACTIVIDADES_MSG.interno,
    });
    expect(JSON.stringify(internal.body)).not.toMatch(
      /driverError|SELECT|stack|ActividadFontanero/i,
    );
  });
});
