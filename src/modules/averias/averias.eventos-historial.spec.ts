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
import { TipoEventoAveria } from '../../common/enums/tipo-evento-averia.enum';
import { Role } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  crearUsuarioPrueba,
  PASSWORD_PRUEBA,
  seedRolesBase,
  seedStaffLoginUsers,
} from '../usuarios/usuarios.test-helpers';
import { AVERIA_ADMIN_INVALID_ID } from './averia-admin-id.pipe';
import { AveriasModule } from './averias.module';
import {
  AVERIAS_TEST_ENTITIES,
  vaciarNotificacionesAveriaPrueba,
} from './averias.test-entities';
import { AVERIA_ADMIN_NOT_FOUND } from './averias.service';
import { Averia } from './entities/averia.entity';
import { HistorialAveria } from './entities/historial-averia.entity';

describe('GET /api/v1/admin/averias/:id/historial', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let averias: Repository<Averia>;
  let historial: Repository<HistorialAveria>;
  let usuarios: Repository<Usuario>;
  let rolesMap: Record<Role, Rol>;
  let adminToken: string;
  let secretariaToken: string;

  const signAs = (role: Role, sub = '1') => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const persistAveria = () =>
    averias.save(
      averias.create({
        codigoSeguimiento: 'AV-2026-0042',
        fechaReporte: new Date('2026-08-22T14:10:00.000Z'),
        nombreReportante: 'María Rodríguez',
        telefonoReportante: '8888-4242',
        correoReportante: 'reportante-secreto@example.com',
        identificacionReportante: '1-1111-1111',
        ubicacion: 'Frente a la escuela',
        sectorComunidad: 'San Juan',
        descripcion: 'Fuga en tubo madre',
        estado: EstadoAveria.RESUELTA,
      }),
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
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
      }),
    );
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    const dataSource = moduleFixture.get(DataSource);
    averias = dataSource.getRepository(Averia);
    historial = dataSource.getRepository(HistorialAveria);
    usuarios = dataSource.getRepository(Usuario);
    rolesMap = await seedRolesBase(dataSource.getRepository(Rol));
    await seedStaffLoginUsers(usuarios, rolesMap);

    const login = (email: string) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD_PRUEBA });
    adminToken = (
      (await login('admin@asadasanjuan.cr')).body as {
        accessToken: string;
      }
    ).accessToken;
    secretariaToken = (
      (await login('secretaria@asadasanjuan.cr')).body as {
        accessToken: string;
      }
    ).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await vaciarNotificacionesAveriaPrueba(averias.manager.connection);
    await averias.clear();
  });

  it('devuelve la línea de tiempo en orden cronológico', async () => {
    const averia = await persistAveria();
    const responsable = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero Traza',
      correo: 'fontanero.linea@asadasanjuan.cr',
      role: Role.FONTANERO,
    });

    await historial.insert([
      {
        idAveria: averia.id,
        tipoEvento: TipoEventoAveria.RESOLUCION,
        descripcion: 'Avería resuelta',
        fechaHora: new Date('2026-08-22T15:30:00.000Z'),
        estadoAnterior: EstadoAveria.EN_ATENCION,
        estadoNuevo: EstadoAveria.RESUELTA,
        idUsuario: responsable.idUsuario,
        referenciaTipo: null,
        referenciaId: null,
      },
      {
        idAveria: averia.id,
        tipoEvento: TipoEventoAveria.REGISTRO,
        descripcion: 'Avería registrada',
        fechaHora: new Date('2026-08-22T14:10:00.000Z'),
        estadoAnterior: null,
        estadoNuevo: EstadoAveria.RECIBIDA,
        idUsuario: null,
        referenciaTipo: null,
        referenciaId: null,
      },
      {
        idAveria: averia.id,
        tipoEvento: TipoEventoAveria.CAMBIO_ESTADO,
        descripcion: 'Cambio a Pendiente de atención',
        fechaHora: new Date('2026-08-22T14:26:00.000Z'),
        estadoAnterior: EstadoAveria.ASIGNADA,
        estadoNuevo: EstadoAveria.PENDIENTE,
        idUsuario: null,
        referenciaTipo: null,
        referenciaId: null,
      },
      {
        idAveria: averia.id,
        tipoEvento: TipoEventoAveria.SALIDA_MATERIAL,
        descripcion: 'Salida de material registrada: Tubo PVC, cantidad 2',
        fechaHora: new Date('2026-08-22T14:30:00.000Z'),
        estadoAnterior: null,
        estadoNuevo: null,
        idUsuario: responsable.idUsuario,
        referenciaTipo: 'MovimientoInventario',
        referenciaId: 15,
      },
    ]);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/averias/${averia.id}/historial`)
      .set(auth(adminToken))
      .expect(200);

    const body = response.body as {
      id: number;
      codigoSeguimiento: string;
      data: Array<{
        tipoEvento: string;
        descripcion: string;
        fechaHora: string;
        usuario: { id: number; nombre: string } | null;
        estadoAnterior: string | null;
        estadoNuevo: string | null;
        referencia: { tipo: string; id: number } | null;
      }>;
    };

    expect(body.id).toBe(averia.id);
    expect(body.codigoSeguimiento).toBe('AV-2026-0042');
    expect(body.data.map((evento) => evento.tipoEvento)).toEqual([
      TipoEventoAveria.REGISTRO,
      TipoEventoAveria.CAMBIO_ESTADO,
      TipoEventoAveria.SALIDA_MATERIAL,
      TipoEventoAveria.RESOLUCION,
    ]);
    expect(body.data[0]?.usuario).toBeNull();
    expect(body.data[0]?.estadoAnterior).toBeNull();
    expect(body.data[0]?.estadoNuevo).toBe(EstadoAveria.RECIBIDA);
    expect(body.data[0]?.referencia).toBeNull();
    expect(body.data[1]?.descripcion).toBe('Cambio a Pendiente de atención');
    expect(body.data[1]?.estadoAnterior).toBe(EstadoAveria.ASIGNADA);
    expect(body.data[1]?.estadoNuevo).toBe(EstadoAveria.PENDIENTE);
    expect(body.data[2]?.referencia).toEqual({
      tipo: 'MovimientoInventario',
      id: 15,
    });
    expect(body.data[3]?.usuario).toEqual({
      id: responsable.idUsuario,
      nombre: 'Fontanero Traza',
    });
    expect(body.data.every((evento) => evento.fechaHora)).toBe(true);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('8888-4242');
    expect(serialized).not.toContain('reportante-secreto@example.com');
    expect(serialized).not.toContain('1-1111-1111');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('fontanero.linea@asadasanjuan.cr');
  });

  it('responde 200 con data vacía si la avería no tiene eventos', async () => {
    const averia = await persistAveria();
    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/averias/${averia.id}/historial`)
      .set(auth(secretariaToken))
      .expect(200);
    expect(response.body).toEqual({
      id: averia.id,
      codigoSeguimiento: 'AV-2026-0042',
      data: [],
    });
  });

  it('responde 404 si la avería no existe', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/averias/99999/historial')
      .set(auth(adminToken))
      .expect(404);
    expect(response.body).toMatchObject({ message: AVERIA_ADMIN_NOT_FOUND });
  });

  it('responde 401 sin token y 403 si el rol no es administrativo', async () => {
    const averia = await persistAveria();
    await request(app.getHttpServer())
      .get(`/api/v1/admin/averias/${averia.id}/historial`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/api/v1/admin/averias/${averia.id}/historial`)
      .set(auth(signAs(Role.FONTANERO, '8')))
      .expect(403);
  });

  it('responde 400 si el id no es un entero positivo', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/averias/abc/historial')
      .set(auth(adminToken))
      .expect(400);
    expect(response.body).toMatchObject({ message: AVERIA_ADMIN_INVALID_ID });
  });
});
