import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import jwtConfig from '../../config/jwt.config';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { AuthModule } from '../auth/auth.module';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

describe('Tarea #338 — Solicitudes aprobadas pendientes', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let findAprobadasPendientes: jest.Mock;

  const respuestaPendientes = {
    solicitudes: [
      {
        idSolicitud: 1,
        nombre: 'María',
        apellidos: 'Rodríguez Mora',
        cedula: '1-2345-6789',
        telefono: '8888-1234',
        correo: 'maria.rodriguez@correo.cr',
        direccion: 'San Juan, Desamparados',
        utilizada: false,
      },
    ],
    mensaje: null,
  };

  const signAs = (role: Role, sub = '1') => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  beforeAll(async () => {
    findAprobadasPendientes = jest.fn();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        AuthModule,
      ],
      controllers: [SolicitudesController],
      providers: [
        {
          provide: SolicitudesService,
          useValue: { findAprobadasPendientes },
        },
        RolesGuard,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findAprobadasPendientes.mockReset();
    findAprobadasPendientes.mockResolvedValue(respuestaPendientes);
  });

  it('GET /solicitudes/aprobadas-pendientes responde 401 sin token', async () => {
    const response = await request(app.getHttpServer())
      .get('/solicitudes/aprobadas-pendientes')
      .expect(401);

    expect(response.body).toMatchObject({ message: 'No autenticado' });
  });

  it('Administradora puede consultar solicitudes pendientes', async () => {
    const response = await request(app.getHttpServer())
      .get('/solicitudes/aprobadas-pendientes')
      .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
      .expect(200);

    expect(response.body).toEqual(respuestaPendientes);
  });

  it('Secretaria puede consultar solicitudes pendientes', async () => {
    await request(app.getHttpServer())
      .get('/solicitudes/aprobadas-pendientes')
      .set('Authorization', `Bearer ${signAs(Role.SECRETARIA, '2')}`)
      .expect(200);
  });

  it('Fontanero recibe 403 al consultar solicitudes pendientes', async () => {
    await request(app.getHttpServer())
      .get('/solicitudes/aprobadas-pendientes')
      .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '3')}`)
      .expect(403);
  });
});
