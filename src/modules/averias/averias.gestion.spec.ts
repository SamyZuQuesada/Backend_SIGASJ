import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import { PrioridadAveria } from '../../common/enums/prioridad-averia.enum';
import { TipoAveria } from '../../common/enums/tipo-averia.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Role } from '../../common/enums/role.enum';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  crearUsuarioPrueba,
  seedRolesBase,
  seedStaffLoginUsers,
} from '../usuarios/usuarios.test-helpers';
import { AveriasModule } from './averias.module';
import {
  AVERIA_ASIGNADA_SIN_FONTANERO,
  AVERIA_EN_ATENCION_SIN_FONTANERO,
  mensajeTransicionEstadoAveriaInvalida,
} from './averias.estado-transiciones';
import { type AveriaAdminDetail } from './averias.service';
import { Averia } from './entities/averia.entity';

describe('PBI 2.3 — PATCH estado, prioridad y clasificación', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let averias: Repository<Averia>;
  let usuarios: Repository<Usuario>;
  let rolesMap: Record<Role, Rol>;
  let adminToken: string;
  let usuarioSeq = 0;

  const persistAveria = async (overrides: Partial<Averia> = {}) => {
    return averias.save(
      averias.create({
        codigoSeguimiento: overrides.codigoSeguimiento ?? 'AV-GES-0001',
        fechaReporte:
          overrides.fechaReporte ?? new Date('2026-09-12T15:00:00.000Z'),
        nombreReportante: 'María Rodríguez',
        telefonoReportante: '8888-1111',
        ubicacion: 'Escuela',
        sectorComunidad: 'San Juan',
        descripcion: 'Fuga',
        estado: overrides.estado ?? EstadoAveria.RECIBIDA,
        idFontaneroAsignado: overrides.idFontaneroAsignado ?? null,
        fechaAsignacion: overrides.fechaAsignacion ?? null,
      }),
    );
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          dropSchema: true,
          entities: [Averia, Usuario, Rol],
          synchronize: true,
        }),
        AuthModule,
        AveriasModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
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
    const dataSource = moduleFixture.get(DataSource);
    averias = dataSource.getRepository(Averia);
    usuarios = dataSource.getRepository(Usuario);
    rolesMap = await seedRolesBase(dataSource.getRepository(Rol));
    await seedStaffLoginUsers(usuarios, rolesMap);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@asadasanjuan.cr', password: 'Password123!' });
    adminToken = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await averias.clear();
    await usuarios.clear();
  });

  it('RECIBIDA → EN_REVISION válido y RECIBIDA → RESUELTA inválido', async () => {
    const saved = await persistAveria({ codigoSeguimiento: 'AV-GES-23' });

    const ok = await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${saved.id}/estado`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: EstadoAveria.EN_REVISION })
      .expect(200);
    expect((ok.body as AveriaAdminDetail).estado).toBe(
      EstadoAveria.EN_REVISION,
    );

    const saved2 = await persistAveria({ codigoSeguimiento: 'AV-GES-INV' });
    const bad = await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${saved2.id}/estado`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: EstadoAveria.RESUELTA })
      .expect(400);
    expect(bad.body).toMatchObject({
      message: mensajeTransicionEstadoAveriaInvalida(
        EstadoAveria.RECIBIDA,
        EstadoAveria.RESUELTA,
      ),
    });
  });

  it('actualiza prioridad y clasificación', async () => {
    const saved = await persistAveria({ codigoSeguimiento: 'AV-GES-PC' });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${saved.id}/prioridad`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ prioridad: PrioridadAveria.ALTA })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${saved.id}/clasificacion`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clasificacion: TipoAveria.FUGA })
      .expect(200);

    const persistida = await averias.findOneBy({ id: saved.id });
    expect(persistida?.prioridad).toBe(PrioridadAveria.ALTA);
    expect(persistida?.tipoAveria).toBe(TipoAveria.FUGA);
  });

  it('EN_REVISION → PENDIENTE sigue permitido sin fontanero', async () => {
    const saved = await persistAveria({
      codigoSeguimiento: 'AV-GES-PEN',
      estado: EstadoAveria.EN_REVISION,
    });

    const ok = await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${saved.id}/estado`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: EstadoAveria.PENDIENTE })
      .expect(200);
    expect((ok.body as AveriaAdminDetail).estado).toBe(EstadoAveria.PENDIENTE);
  });

  it('EN_REVISION → ASIGNADA sin fontanero → 400', async () => {
    const saved = await persistAveria({
      codigoSeguimiento: 'AV-GES-ASG',
      estado: EstadoAveria.EN_REVISION,
    });

    const bad = await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${saved.id}/estado`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: EstadoAveria.ASIGNADA })
      .expect(400);
    expect(bad.body).toMatchObject({
      message: AVERIA_ASIGNADA_SIN_FONTANERO,
    });
    const persistida = await averias.findOneBy({ id: saved.id });
    expect(persistida?.estado).toBe(EstadoAveria.EN_REVISION);
    expect(persistida?.idFontaneroAsignado).toBeNull();
  });

  it('PENDIENTE → ASIGNADA sin fontanero → 400', async () => {
    const saved = await persistAveria({
      codigoSeguimiento: 'AV-GES-PAS',
      estado: EstadoAveria.PENDIENTE,
    });

    const bad = await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${saved.id}/estado`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: EstadoAveria.ASIGNADA })
      .expect(400);
    expect(bad.body).toMatchObject({
      message: AVERIA_ASIGNADA_SIN_FONTANERO,
    });
  });

  it('PENDIENTE → EN_ATENCION sin fontanero → 400', async () => {
    const saved = await persistAveria({
      codigoSeguimiento: 'AV-GES-EAT',
      estado: EstadoAveria.PENDIENTE,
    });

    const bad = await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${saved.id}/estado`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: EstadoAveria.EN_ATENCION })
      .expect(400);
    expect(bad.body).toMatchObject({
      message: AVERIA_EN_ATENCION_SIN_FONTANERO,
    });
  });

  it('PENDIENTE con fontanero puede volver a ASIGNADA por PATCH estado', async () => {
    const fontanero = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero gestión',
      correo: `fontanero.ges.${++usuarioSeq}.${Date.now()}@asadasanjuan.cr`,
      role: Role.FONTANERO,
    });
    const saved = await persistAveria({
      codigoSeguimiento: 'AV-GES-BACK',
      estado: EstadoAveria.PENDIENTE,
      idFontaneroAsignado: fontanero.idUsuario,
      fechaAsignacion: new Date('2026-09-13T08:00:00.000Z'),
    });

    const ok = await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${saved.id}/estado`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: EstadoAveria.ASIGNADA })
      .expect(200);
    const body = ok.body as AveriaAdminDetail;
    expect(body.estado).toBe(EstadoAveria.ASIGNADA);
    expect(body.fontanero).toEqual({
      id: fontanero.idUsuario,
      nombre: fontanero.nombre,
    });
  });

  it('estados finales siguen sin transiciones', async () => {
    const resuelta = await persistAveria({
      codigoSeguimiento: 'AV-GES-FIN',
      estado: EstadoAveria.RESUELTA,
    });

    const bad = await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${resuelta.id}/estado`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: EstadoAveria.EN_REVISION })
      .expect(400);
    expect(bad.body).toMatchObject({
      message: mensajeTransicionEstadoAveriaInvalida(
        EstadoAveria.RESUELTA,
        EstadoAveria.EN_REVISION,
      ),
    });
  });
});
