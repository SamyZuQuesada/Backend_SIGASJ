import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { TipoActividadFontaneroCodigo } from '../../common/enums/tipo-actividad-fontanero-codigo.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { ActividadesFontaneroModule } from './actividades-fontanero.module';
import type { ListadoTiposActividadResponse } from './actividades-fontanero.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import { TipoActividadFontanero } from './entities/tipo-actividad-fontanero.entity';
import { seedTiposActividadFontanero } from './testing/actividades-fontanero.test-helpers';
import { TIPOS_ACTIVIDAD_FONTANERO_INICIALES } from './tipo-actividad-fontanero.catalogo';

describe('Catálogo de tipos de actividad del fontanero', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let tipos: Repository<TipoActividadFontanero>;

  const signAs = (role: Role, sub = 'fontanero-1') => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          dropSchema: true,
          entities: [ActividadFontanero, TipoActividadFontanero, Usuario],
          synchronize: true,
        }),
        AuthModule,
        ActividadesFontaneroModule,
      ],
      providers: [
        {
          provide: APP_FILTER,
          useClass: HttpExceptionFilter,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    tipos = moduleFixture.get(getRepositoryToken(TipoActividadFontanero));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await tipos.clear();
    await seedTiposActividadFontanero(tipos);
  });

  it('devuelve los 6 tipos iniciales en el orden del catálogo', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/fontanero/actividades/tipos')
      .set('Authorization', `Bearer ${signAs(Role.FONTANERO)}`)
      .expect(200);

    const body = response.body as ListadoTiposActividadResponse;
    expect(body.total).toBe(6);
    expect(body.data.map((item) => item.codigo)).toEqual(
      TIPOS_ACTIVIDAD_FONTANERO_INICIALES.map((tipo) => tipo.codigo),
    );
    expect(body.data.map((item) => item.nombre)).toEqual([
      'Control de Fugas',
      'Toma de presión',
      'Visita de Campo',
      'Control de Cloros',
      'Control Operativo',
      'Incapacidad o vacaciones',
    ]);
  });

  it('omite tipos inactivos', async () => {
    const incapacidad = await tipos.findOneByOrFail({
      codigo: TipoActividadFontaneroCodigo.INCAPACIDAD_VACACIONES,
    });
    incapacidad.activo = false;
    await tipos.save(incapacidad);

    const response = await request(app.getHttpServer())
      .get('/api/v1/fontanero/actividades/tipos')
      .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA, 'admin-1')}`)
      .expect(200);

    const body = response.body as ListadoTiposActividadResponse;
    expect(body.total).toBe(5);
    expect(body.data.map((item) => item.codigo)).not.toContain(
      TipoActividadFontaneroCodigo.INCAPACIDAD_VACACIONES,
    );
  });

  it('no se interpreta /tipos como id de actividad', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/fontanero/actividades/tipos')
      .set('Authorization', `Bearer ${signAs(Role.FONTANERO)}`)
      .expect(200);

    const body = response.body as ListadoTiposActividadResponse;
    expect(body).toHaveProperty('data');
    expect(body).not.toHaveProperty('statusCode');
  });
});
