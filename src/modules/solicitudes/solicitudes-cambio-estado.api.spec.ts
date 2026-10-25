import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import jwtConfig from '../../config/jwt.config';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { CambioEstadoSolicitudResponseDto } from './dto/cambio-estado-solicitud.response';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

describe('API PATCH /solicitudes/:id/estado', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let mockActualizarEstado: jest.Mock;

  const jwtSecret = 'super_secret_jwt_key_sigasj_2026';

  const signAs = (role: Role, sub: number = 7) =>
    jwtService.sign({
      sub,
      email: `${role.toLowerCase()}@asada.cr`,
      role,
      name: role,
    });

  beforeAll(async () => {
    process.env.JWT_SECRET = jwtSecret;
    mockActualizarEstado = jest.fn().mockResolvedValue({
      solicitudId: 1,
      codigoSeguimiento: 'SOL-2026-00001',
      estadoAnterior: EstadoSolicitud.PENDIENTE,
      estadoNuevo: EstadoSolicitud.EN_REVISION,
      observacionPublica: 'Mensaje público',
      notaInterna: 'Nota interna',
      idUsuario: 7,
      fecha: new Date('2026-10-24T18:00:00Z'),
      historialId: 41,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: jwtSecret,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [SolicitudesController],
      providers: [
        JwtStrategy,
        RolesGuard,
        {
          provide: SolicitudesService,
          useValue: {
            actualizarEstado: mockActualizarEstado,
            findAprobadasPendientes: jest.fn(),
            findByCodigoSeguimiento: jest.fn(),
            findById: jest.fn(),
            findAll: jest.fn(),
            crearSolicitudArregloPago: jest.fn(),
            crearSolicitudCambioTitular: jest.fn(),
            crearSolicitudInfraestructuraLinderos: jest.fn(),
            crearSolicitudAfiliacion: jest.fn(),
            crearSolicitudDisponibilidadServicios: jest.fn(),
            crearSolicitudConstanciaServicio: jest.fn(),
            subirDocumentoSolicitud: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    mockActualizarEstado.mockClear();
  });

  it('sin JWT → 401 y no llama al service', async () => {
    await request(app.getHttpServer())
      .patch('/solicitudes/1/estado')
      .send({ estadoNuevo: EstadoSolicitud.EN_REVISION })
      .expect(401);

    expect(mockActualizarEstado).not.toHaveBeenCalled();
  });

  it.each([Role.FONTANERO, Role.ABONADO, Role.AYUDANTE])(
    'rol %s → 403 y no cambia estado',
    async (role) => {
      await request(app.getHttpServer())
        .patch('/solicitudes/1/estado')
        .set('Authorization', `Bearer ${signAs(role)}`)
        .send({ estadoNuevo: EstadoSolicitud.EN_REVISION })
        .expect(403);

      expect(mockActualizarEstado).not.toHaveBeenCalled();
    },
  );

  it('ADMINISTRADORA cambia estado válido → 200', async () => {
    const res = await request(app.getHttpServer())
      .patch('/solicitudes/1/estado')
      .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA, 7)}`)
      .send({
        estadoNuevo: EstadoSolicitud.EN_REVISION,
        observacionPublica: 'Mensaje público',
        notaInterna: 'Nota interna',
      })
      .expect(200);

    const body = res.body as CambioEstadoSolicitudResponseDto;
    expect(body.estadoNuevo).toBe(EstadoSolicitud.EN_REVISION);
    expect(mockActualizarEstado).toHaveBeenCalledTimes(1);
    const [, dto, user] = mockActualizarEstado.mock.calls[0] as [
      number,
      { estadoNuevo: string },
      { idUsuario?: number; role: Role },
    ];
    expect(dto.estadoNuevo).toBe(EstadoSolicitud.EN_REVISION);
    expect(user.idUsuario).toBe(7);
    expect(user.role).toBe(Role.ADMINISTRADORA);
  });

  it('SECRETARIA también puede cambiar estado → 200', async () => {
    await request(app.getHttpServer())
      .patch('/solicitudes/1/estado')
      .set('Authorization', `Bearer ${signAs(Role.SECRETARIA, 9)}`)
      .send({ estadoNuevo: EstadoSolicitud.APROBADA })
      .expect(200);

    expect(mockActualizarEstado).toHaveBeenCalled();
  });

  it('estadoNuevo inválido → 400', async () => {
    await request(app.getHttpServer())
      .patch('/solicitudes/1/estado')
      .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
      .send({ estadoNuevo: 'URGENTE' })
      .expect(400);

    expect(mockActualizarEstado).not.toHaveBeenCalled();
  });

  it('mass assignment: usuarioId/estadoAnterior/fecha → 400 (forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .patch('/solicitudes/1/estado')
      .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA, 7)}`)
      .send({
        estadoNuevo: EstadoSolicitud.EN_REVISION,
        usuarioId: 999,
        idUsuario: 999,
        estadoAnterior: EstadoSolicitud.APROBADA,
        fecha: '2000-01-01T00:00:00.000Z',
        solicitudId: 55,
      })
      .expect(400);

    expect(mockActualizarEstado).not.toHaveBeenCalled();
  });

  it('el usuario del JWT (sub) llega al service, no un id del body', async () => {
    await request(app.getHttpServer())
      .patch('/solicitudes/1/estado')
      .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA, 7)}`)
      .send({ estadoNuevo: EstadoSolicitud.FINALIZADA })
      .expect(200);

    const [, , user] = mockActualizarEstado.mock.calls[0] as [
      number,
      unknown,
      { idUsuario?: number },
    ];
    expect(user.idUsuario).toBe(7);
  });
});
