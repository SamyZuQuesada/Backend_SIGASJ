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
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Asociado } from './entities/asociado.entity';
import { AsociadosModule } from './asociados.module';

describe('Endpoint POST /api/v1/asociados y /api/asociados (Registro de Asociados)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let asociadoRepository: Repository<Asociado>;

  let adminToken: string;
  let secretariaToken: string;
  let fontaneroToken: string;
  let abonadoToken: string;

  const signAs = (role: Role, sub = '1') => {
    const payload: JwtPayload = {
      sub,
      email: `${role.toLowerCase()}@asadasanjuan.cr`,
      role,
      name: `Usuario ${role}`,
    };
    return jwtService.sign(payload);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          dropSchema: true,
          entities: [Asociado],
          synchronize: true,
        }),
        AuthModule,
        AsociadosModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Middleware de alias para /api/asociados -> /api/v1/asociados
    app.use((req: any, _res: any, next: any) => {
      if (
        req.url === '/api/asociados' ||
        req.url.startsWith('/api/asociados?')
      ) {
        req.url = req.url.replace('/api/asociados', '/api/v1/asociados');
      }
      next();
    });

    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();

    jwtService = moduleFixture.get(JwtService);
    asociadoRepository = moduleFixture.get(getRepositoryToken(Asociado));

    adminToken = signAs(Role.ADMINISTRADORA, '10');
    secretariaToken = signAs(Role.SECRETARIA, '20');
    fontaneroToken = signAs(Role.FONTANERO, '30');
    abonadoToken = signAs(Role.ABONADO, '40');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await asociadoRepository.clear();
  });

  describe('Control de Acceso y Autenticación', () => {
    const validBody = {
      nombre: 'Carlos',
      apellidos: 'Mora Rodríguez',
      cedula: '1-1234-0567',
      correoElectronico: 'carlos.mora@asadasanjuan.cr',
    };

    it('rechaza la petición sin autenticación (401 Unauthorized)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .send(validBody);

      expect(response.status).toBe(401);
    });

    it('rechaza la petición con token JWT inválido (401 Unauthorized)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .set('Authorization', 'Bearer token_invalido_123')
        .send(validBody);

      expect(response.status).toBe(401);
    });

    it('rechaza la petición de un FONTANERO (403 Forbidden)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .set('Authorization', `Bearer ${fontaneroToken}`)
        .send(validBody);

      expect(response.status).toBe(403);
    });

    it('rechaza la petición de un ABONADO (403 Forbidden)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .set('Authorization', `Bearer ${abonadoToken}`)
        .send(validBody);

      expect(response.status).toBe(403);
    });

    it('permite el acceso con rol SECRETARIA (201 Created)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .set('Authorization', `Bearer ${secretariaToken}`)
        .send({
          ...validBody,
          cedula: '5-9999-0001',
          correoElectronico: 'secretaria.crea@asadasanjuan.cr',
        });

      expect(response.status).toBe(201);
      expect(response.body.cedula).toBe('5-9999-0001');
    });

    it('permite el acceso con rol ADMINISTRADORA (201 Created)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validBody,
          cedula: '5-9999-0002',
          correoElectronico: 'admin.crea@asadasanjuan.cr',
        });

      expect(response.status).toBe(201);
      expect(response.body.cedula).toBe('5-9999-0002');
    });
  });

  describe('Registro Exitoso y Persistencia', () => {
    it('registra un asociado válido, con activo = true y fechaInactivacion = null', async () => {
      const body = {
        nombre: '  Ana María  ',
        apellidos: '  Rojas Morales  ',
        cedula: '  1-1111-2222  ',
        correoElectronico: '  Ana.Rojas@Example.com  ',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.nombre).toBe('Ana María');
      expect(response.body.apellidos).toBe('Rojas Morales');
      expect(response.body.cedula).toBe('1-1111-2222');
      expect(response.body.correoElectronico).toBe('ana.rojas@example.com');
      expect(response.body.activo).toBe(true);
      expect(response.body.fechaInactivacion).toBeNull();
      expect(response.body).toHaveProperty('fechaRegistro');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');

      // Verificar persistencia en base de datos
      const guardado = await asociadoRepository.findOneBy({
        cedula: '1-1111-2222',
      });
      expect(guardado).toBeDefined();
      expect(guardado?.nombre).toBe('Ana María');
      expect(guardado?.activo).toBe(true);
      expect(guardado?.fechaInactivacion).toBeNull();
    });

    it('funciona también llamando al alias /api/asociados', async () => {
      const body = {
        nombre: 'Pedro',
        apellidos: 'Gutiérrez',
        cedula: '2-0555-0888',
        correoElectronico: 'pedro@example.cr',
      };

      const response = await request(app.getHttpServer())
        .post('/api/asociados')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);

      expect(response.status).toBe(201);
      expect(response.body.cedula).toBe('2-0555-0888');
    });

    it('permite registrar con una fechaRegistro específica en formato ISO', async () => {
      const fechaEspecifica = '2024-06-20T10:00:00.000Z';
      const body = {
        nombre: 'Laura',
        apellidos: 'Chaves Solís',
        cedula: '3-0222-0333',
        correoElectronico: 'laura@example.cr',
        fechaRegistro: fechaEspecifica,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);

      expect(response.status).toBe(201);
      expect(new Date(response.body.fechaRegistro).toISOString()).toBe(
        new Date(fechaEspecifica).toISOString(),
      );
    });
  });

  describe('Validación de Datos Incompletos e Inválidos', () => {
    it('rechaza si falta el nombre (400 Bad Request)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          apellidos: 'Pérez',
          cedula: '1-2345-6789',
          correoElectronico: 'perez@test.cr',
        });

      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).toContain('nombre');
    });

    it('rechaza si el nombre solo contiene espacios (400 Bad Request)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: '   ',
          apellidos: 'Pérez',
          cedula: '1-2345-6789',
          correoElectronico: 'perez@test.cr',
        });

      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).toContain('nombre');
    });

    it('rechaza si faltan los apellidos (400 Bad Request)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Juan',
          cedula: '1-2345-6789',
          correoElectronico: 'juan@test.cr',
        });

      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).toContain('apellidos');
    });

    it('rechaza si falta la cédula (400 Bad Request)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Juan',
          apellidos: 'Pérez',
          correoElectronico: 'juan@test.cr',
        });

      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).toContain('cédula');
    });

    it('rechaza si falta el correo electrónico (400 Bad Request)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Juan',
          apellidos: 'Pérez',
          cedula: '1-2345-6789',
        });

      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).toContain('correo');
    });

    it('rechaza formato de correo electrónico inválido (400 Bad Request)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Juan',
          apellidos: 'Pérez',
          cedula: '1-2345-6789',
          correoElectronico: 'correo-invalido-sin-arroba',
        });

      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).toContain('correo');
    });

    it('rechaza propiedades no permitidas por whitelist (400 Bad Request)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Juan',
          apellidos: 'Pérez',
          cedula: '1-2345-6789',
          correoElectronico: 'juan@test.cr',
          propiedadInyectada: 'hack',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Verificación de Cédula Duplicada', () => {
    it('rechaza con 409 Conflict si se intenta registrar una cédula ya existente', async () => {
      const primerRegistro = {
        nombre: 'Original',
        apellidos: 'Asociado',
        cedula: '5-0999-0888',
        correoElectronico: 'original@test.cr',
      };

      const res1 = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(primerRegistro);

      expect(res1.status).toBe(201);

      // Intento de duplicado con la misma cédula
      const duplicado = {
        nombre: 'Duplicado',
        apellidos: 'Intento',
        cedula: '5-0999-0888',
        correoElectronico: 'duplicado@test.cr',
      };

      const res2 = await request(app.getHttpServer())
        .post('/api/v1/asociados')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicado);

      expect(res2.status).toBe(409);
      expect(res2.body.message).toContain('5-0999-0888');
    });
  });

  describe('GET /api/v1/asociados (Listado de asociados)', () => {
    it('permite listar asociados a usuarios con rol SECRETARIA o ADMINISTRADORA', async () => {
      await asociadoRepository.save([
        asociadoRepository.create({
          nombre: 'Asoc1',
          apellidos: 'A1',
          cedula: '111',
          correoElectronico: 'a1@test.cr',
          activo: true,
          fechaRegistro: new Date(),
        }),
        asociadoRepository.create({
          nombre: 'Asoc2',
          apellidos: 'A2',
          cedula: '222',
          correoElectronico: 'a2@test.cr',
          activo: true,
          fechaRegistro: new Date(),
        }),
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/v1/asociados')
        .set('Authorization', `Bearer ${secretariaToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });
  });
});
