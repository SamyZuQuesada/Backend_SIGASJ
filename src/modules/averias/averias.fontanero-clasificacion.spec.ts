import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import { PrioridadAveria } from '../../common/enums/prioridad-averia.enum';
import { Role } from '../../common/enums/role.enum';
import { TipoAveria } from '../../common/enums/tipo-averia.enum';
import { TipoNotificacionAveria } from '../../common/enums/tipo-notificacion-averia.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { NotificacionAveria } from '../notificaciones/entities/notificacion-averia.entity';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  crearUsuarioPrueba,
  seedRolesBase,
} from '../usuarios/usuarios.test-helpers';
import { AveriasModule } from './averias.module';
import {
  AVERIAS_TEST_ENTITIES,
  vaciarNotificacionesAveriaPrueba,
} from './averias.test-entities';
import {
  AVERIA_FONTANERO_FORBIDDEN,
  AVERIA_FONTANERO_YA_CERRADA,
} from './averias.service';
import { Averia } from './entities/averia.entity';

describe('PATCH /api/v1/fontanero/averias/:id — calificar prioridad y tipo', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let averias: Repository<Averia>;
  let notificaciones: Repository<NotificacionAveria>;
  let usuarios: Repository<Usuario>;
  let rolesMap: Record<Role, Rol>;
  let fontaneroA: Usuario;
  let fontaneroB: Usuario;
  let administradora: Usuario;
  let tokenA: string;
  let tokenB: string;
  let adminToken: string;
  let seq = 0;

  const signAs = (role: Role, sub: string) => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  const persist = async (overrides: Partial<Averia> = {}) => {
    seq += 1;
    return averias.save(
      averias.create({
        codigoSeguimiento: overrides.codigoSeguimiento ?? `AV-CAL-${seq}`,
        fechaReporte: new Date('2026-09-12T15:00:00.000Z'),
        nombreReportante: 'María Rodríguez',
        telefonoReportante: '8888-1111',
        ubicacion: 'Frente a la escuela',
        sectorComunidad: 'San Juan',
        descripcion: 'Fuga en tubería de distribución.',
        estado: overrides.estado ?? EstadoAveria.ASIGNADA,
        tipoAveria: overrides.tipoAveria ?? null,
        prioridad: overrides.prioridad ?? null,
        idFontaneroAsignado:
          overrides.idFontaneroAsignado === undefined
            ? fontaneroA.idUsuario
            : overrides.idFontaneroAsignado,
        fechaAsignacion: new Date('2026-09-13T08:15:00.000Z'),
      }),
    );
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
          entities: [...AVERIAS_TEST_ENTITIES],
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
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    const dataSource = moduleFixture.get(DataSource);
    averias = dataSource.getRepository(Averia);
    notificaciones = dataSource.getRepository(NotificacionAveria);
    usuarios = dataSource.getRepository(Usuario);
    rolesMap = await seedRolesBase(dataSource.getRepository(Rol));

    fontaneroA = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero A',
      correo: 'fontanero.a@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    fontaneroB = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero B',
      correo: 'fontanero.b@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    administradora = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Administradora',
      correo: 'admin.clasif@asadasanjuan.cr',
      role: Role.ADMINISTRADORA,
    });
    tokenA = signAs(Role.FONTANERO, String(fontaneroA.idUsuario));
    tokenB = signAs(Role.FONTANERO, String(fontaneroB.idUsuario));
    adminToken = signAs(Role.ADMINISTRADORA, String(administradora.idUsuario));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await vaciarNotificacionesAveriaPrueba(averias.manager.connection);
    await averias.clear();
  });

  it('el Fontanero asignado califica Baja / Media / Alta y Tubo madre / Tubo medidor', async () => {
    const saved = await persist();

    const prioridad = await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${saved.id}/prioridad`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ prioridad: PrioridadAveria.MEDIA })
      .expect(200);

    expect(prioridad.body.prioridad).toBe(PrioridadAveria.MEDIA);
    expect(await notificaciones.count()).toBe(0);

    const tipo = await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${saved.id}/clasificacion`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clasificacion: TipoAveria.TUBO_MADRE })
      .expect(200);

    expect(tipo.body.tipoAveria).toBe(TipoAveria.TUBO_MADRE);

    const persistida = await averias.findOneByOrFail({ id: saved.id });
    expect(persistida.prioridad).toBe(PrioridadAveria.MEDIA);
    expect(persistida.tipoAveria).toBe(TipoAveria.TUBO_MADRE);

    const filas = await notificaciones.find({
      where: {
        tipo: TipoNotificacionAveria.AVERIA_CLASIFICADA_ADMINISTRADORA,
      },
    });
    expect(filas).toHaveLength(1);
    expect(filas[0]?.idUsuarioDestinatario).toBe(administradora.idUsuario);
    expect(filas[0]?.idAveria).toBe(saved.id);
    expect(filas[0]?.mensaje).toContain('Media');
    expect(filas[0]?.mensaje).toContain('Tubo madre');
  });

  it('no duplica la notificación de clasificación si vuelve a calificar', async () => {
    const saved = await persist({
      prioridad: PrioridadAveria.BAJA,
      tipoAveria: TipoAveria.TUBO_MEDIDOR,
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${saved.id}/prioridad`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ prioridad: PrioridadAveria.ALTA })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${saved.id}/clasificacion`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clasificacion: TipoAveria.TUBO_MADRE })
      .expect(200);

    expect(
      await notificaciones.count({
        where: {
          tipo: TipoNotificacionAveria.AVERIA_CLASIFICADA_ADMINISTRADORA,
          idAveria: saved.id,
        },
      }),
    ).toBe(1);
  });

  it('rechaza Urgente, Fuga u otro tipo fuera del diagrama', async () => {
    const saved = await persist();

    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${saved.id}/prioridad`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ prioridad: PrioridadAveria.URGENTE })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${saved.id}/clasificacion`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clasificacion: TipoAveria.FUGA })
      .expect(400);
  });

  it('otro Fontanero o la Administradora no pueden calificar', async () => {
    const saved = await persist();

    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${saved.id}/prioridad`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ prioridad: PrioridadAveria.ALTA })
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe(AVERIA_FONTANERO_FORBIDDEN);
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${saved.id}/clasificacion`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clasificacion: TipoAveria.TUBO_MEDIDOR })
      .expect(403);
  });

  it('no califica una avería resuelta', async () => {
    const saved = await persist({ estado: EstadoAveria.RESUELTA });

    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${saved.id}/prioridad`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ prioridad: PrioridadAveria.BAJA })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe(AVERIA_FONTANERO_YA_CERRADA);
      });
  });
});
