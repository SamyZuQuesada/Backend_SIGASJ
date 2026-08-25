import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import jwtConfig from '../../config/jwt.config';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { AuthModule } from '../auth/auth.module';
import { SolicitudServicio } from '../solicitudes/entities/solicitud-servicio.entity';
import { Servicio } from '../servicios/entities/servicio.entity';
import { AbonadosController } from './abonados.controller';
import { AbonadosService } from './abonados.service';
import { Abonado } from './entities/abonado.entity';
import request from 'supertest';
import { App } from 'supertest/types';

describe('Gestión de Abonados — pruebas de autenticación y autorización', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let findOne: jest.Mock;

  const abonado10 = { idAbonado: 10, idUsuario: 10 };
  const abonado11 = { idAbonado: 11, idUsuario: 11 };

  const signAs = (role: Role, sub: string, expiresIn?: number) => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role,
      name: 'Usuario',
    };
    return expiresIn === undefined
      ? jwtService.sign(payload)
      : jwtService.sign(payload, { expiresIn });
  };

  beforeAll(async () => {
    findOne = jest.fn();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        AuthModule,
      ],
      controllers: [AbonadosController],
      providers: [
        AbonadosService,
        RolesGuard,
        {
          provide: getRepositoryToken(Abonado),
          useValue: { findOne, exists: jest.fn() },
        },
        {
          provide: getRepositoryToken(Servicio),
          useValue: { exists: jest.fn() },
        },
        {
          provide: getRepositoryToken(SolicitudServicio),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
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
    findOne.mockReset();
  });

  describe('Prueba 1 — Sin token', () => {
    it('GET privado responde 401 Unauthorized', async () => {
      const response = await request(app.getHttpServer())
        .get('/abonados/me')
        .expect(401);

      expect(response.body).toMatchObject({ message: 'No autenticado' });
    });
  });

  describe('Prueba 2 — Token inválido', () => {
    it('rechaza el acceso con 401', async () => {
      const response = await request(app.getHttpServer())
        .get('/abonados/10')
        .set('Authorization', 'Bearer token-invalido')
        .expect(401);

      expect(response.body).toMatchObject({ message: 'No autenticado' });
      expect(JSON.stringify(response.body)).not.toMatch(/jwt|secret|eyJ/i);
    });
  });

  describe('Prueba 3 — Token vencido', () => {
    it('rechaza el acceso con 401', async () => {
      const vencido = signAs(Role.ABONADO, '10', 0);

      const response = await request(app.getHttpServer())
        .get('/abonados/10')
        .set('Authorization', `Bearer ${vencido}`)
        .expect(401);

      expect(response.body).toMatchObject({ message: 'No autenticado' });
      expect(JSON.stringify(response.body)).not.toMatch(/expired|jwt/i);
    });
  });

  describe('Prueba 4 — Administradora', () => {
    it('consulta endpoints administrativos existentes (GET /abonados/:id)', async () => {
      findOne.mockResolvedValue(abonado11);

      await request(app.getHttpServer())
        .get('/abonados/11')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA, '1')}`)
        .expect(200)
        .expect(abonado11);

      expect(findOne).toHaveBeenCalledWith({ where: { idAbonado: 11 } });
    });
  });

  describe('Prueba 5 — Abonado consulta su información', () => {
    it('GET /abonados/me y GET /abonados/10 responden 200', async () => {
      findOne.mockResolvedValue(abonado10);
      const token = signAs(Role.ABONADO, '10');

      await request(app.getHttpServer())
        .get('/abonados/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(abonado10);

      findOne.mockResolvedValue(abonado10);
      await request(app.getHttpServer())
        .get('/abonados/10')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(abonado10);
    });
  });

  describe('Prueba 6 — Abonado consulta otro registro', () => {
    it('GET /abonados/11 responde 403 Forbidden', async () => {
      findOne.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/abonados/11')
        .set('Authorization', `Bearer ${signAs(Role.ABONADO, '10')}`)
        .expect(403);

      expect(response.body).toMatchObject({ message: 'Acceso denegado' });
    });
  });

  describe('Prueba 7 — Abonado intenta listar todos', () => {
    it('no existe GET de listado administrativo; Abonado no obtiene el padrón', async () => {
      const response = await request(app.getHttpServer())
        .get('/abonados')
        .set('Authorization', `Bearer ${signAs(Role.ABONADO, '10')}`);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(findOne).not.toHaveBeenCalled();
    });
  });

  describe('Prueba 8 — Abonado intenta operación administrativa', () => {
    it('Abonado recibe 403 al intentar registrar abonados', async () => {
      const token = signAs(Role.ABONADO, '10');

      const post = await request(app.getHttpServer())
        .post('/abonados')
        .set('Authorization', `Bearer ${token}`)
        .send({ idAbonado: 11 });

      const patch = await request(app.getHttpServer())
        .patch('/abonados/11')
        .set('Authorization', `Bearer ${token}`)
        .send({ idUsuario: 11 });

      expect(post.status).toBe(403);
      expect(patch.status).toBeGreaterThanOrEqual(400);
      expect(findOne).not.toHaveBeenCalled();
    });
  });

  describe('Prueba 9 — Solicitud de actualización', () => {
    it('la funcionalidad no está implementada; no hay endpoint que asociar a otro Abonado', async () => {
      const response = await request(app.getHttpServer())
        .post('/abonados/10/solicitudes-actualizacion')
        .set('Authorization', `Bearer ${signAs(Role.ABONADO, '10')}`)
        .send({ idAbonado: 11, idUsuario: 11 });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Prueba 10 — Otro rol', () => {
    it('FONTANERO autenticado recibe 403 en Gestión de Abonados', async () => {
      const response = await request(app.getHttpServer())
        .get('/abonados/10')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '3')}`)
        .expect(403);

      expect(response.body).toMatchObject({ message: 'Acceso denegado' });
    });

    it('SECRETARIA puede consultar un abonado por id', async () => {
      findOne.mockResolvedValue(abonado10);

      await request(app.getHttpServer())
        .get('/abonados/10')
        .set('Authorization', `Bearer ${signAs(Role.SECRETARIA, '3')}`)
        .expect(200);
    });
  });

  describe('Prueba 11 — Manipulación del body', () => {
    it('idUsuario/idAbonado ajenos en body o query no cambian la identidad de sesión', async () => {
      findOne.mockResolvedValue(abonado10);
      const token = signAs(Role.ABONADO, '10');

      await request(app.getHttpServer())
        .get('/abonados/me')
        .query({ idAbonado: 11, idUsuario: 11 })
        .send({ idAbonado: 11, idUsuario: 11, propietario: 11 })
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(abonado10);

      expect(findOne).toHaveBeenCalledWith({ where: { idUsuario: 10 } });

      findOne.mockResolvedValue(abonado10);
      await request(app.getHttpServer())
        .get('/abonados/10')
        .send({ idAbonado: 11, idUsuario: 11 })
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(abonado10);

      expect(findOne).toHaveBeenCalledWith({
        where: { idAbonado: 10, idUsuario: 10 },
      });
    });
  });
});
