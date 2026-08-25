import { INestApplication, ValidationPipe } from '@nestjs/common';
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
import { AbonadosController } from './abonados.controller';
import { AbonadosService } from './abonados.service';

describe('Tarea #339 — POST /abonados', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let register: jest.Mock;

  const payload = {
    nombre: 'María',
    apellidos: 'Rodríguez Mora',
    cedula: '1-2345-6789',
    telefono: '8888-1234',
    correo: 'maria.rodriguez@correo.cr',
    direccion: 'San Juan, Desamparados',
    servicio: {
      nis: 'NIS-2026-001',
      medidor: 'MED-45821',
      sector: 'Sector Centro',
      tarifa: 'Residencial',
      numeroPlano: 'PL-1024',
    },
  };

  const signAs = (role: Role, sub = '1') => {
    const tokenPayload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role,
      name: 'Usuario',
    };
    return jwtService.sign(tokenPayload);
  };

  beforeAll(async () => {
    register = jest.fn();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
        AuthModule,
      ],
      controllers: [AbonadosController],
      providers: [
        { provide: AbonadosService, useValue: { register } },
        RolesGuard,
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
    await app.close();
  });

  beforeEach(() => {
    register.mockReset();
    register.mockResolvedValue({
      idAbonado: 12,
      mensaje: 'Abonado y servicio registrados correctamente.',
    });
  });

  it('responde 401 sin token', async () => {
    await request(app.getHttpServer()).post('/abonados').send(payload).expect(401);
  });

  it('Administradora puede registrar abonado', async () => {
    const response = await request(app.getHttpServer())
      .post('/abonados')
      .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
      .send(payload)
      .expect(201);

    expect(response.body).toEqual({
      idAbonado: 12,
      mensaje: 'Abonado y servicio registrados correctamente.',
    });
  });

  it('Secretaria puede registrar abonado', async () => {
    await request(app.getHttpServer())
      .post('/abonados')
      .set('Authorization', `Bearer ${signAs(Role.SECRETARIA, '2')}`)
      .send(payload)
      .expect(201);
  });

  it('Abonado recibe 403', async () => {
    await request(app.getHttpServer())
      .post('/abonados')
      .set('Authorization', `Bearer ${signAs(Role.ABONADO, '10')}`)
      .send(payload)
      .expect(403);
  });
});
