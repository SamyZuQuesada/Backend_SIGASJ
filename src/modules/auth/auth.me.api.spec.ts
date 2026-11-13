import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '../../common/enums/role.enum';
import jwtConfig from '../../config/jwt.config';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { JwtStrategy } from './strategies/jwt.strategy';

describe('GET /auth/me — sesión JWT', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  const secret = 'super_secret_jwt_key_sigasj_2026';

  const usuariosService = {
    findByIdForAuth: jest.fn(),
    findByCorreoForAuth: jest.fn(),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    process.env.NODE_ENV = 'test';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret, signOptions: { expiresIn: '1h' } }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        { provide: UsuariosService, useValue: usuariosService },
        {
          provide: PasswordService,
          useValue: { comparePassword: jest.fn(), hashPassword: jest.fn() },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    usuariosService.findByIdForAuth.mockReset();
    usuariosService.findByIdForAuth.mockResolvedValue({
      idUsuario: 7,
      correo: 'fontanero@asadasanjuan.cr',
      nombre: 'Fontanero',
      activo: true,
      rol: { nombre: Role.FONTANERO },
    });
  });

  it('sin token → 401', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('token válido → 200 con usuario mínimo', async () => {
    const token = jwtService.sign({
      sub: 7,
      email: 'fontanero@asadasanjuan.cr',
      role: Role.FONTANERO,
      name: 'Fontanero',
    });

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      id: 7,
      email: 'fontanero@asadasanjuan.cr',
      role: Role.FONTANERO,
      name: 'Fontanero',
    });
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('password');
  });

  it('usuario inactivo → 401', async () => {
    usuariosService.findByIdForAuth.mockResolvedValue({
      idUsuario: 7,
      correo: 'fontanero@asadasanjuan.cr',
      nombre: 'Fontanero',
      activo: false,
      rol: { nombre: Role.FONTANERO },
    });

    const token = jwtService.sign({
      sub: 7,
      email: 'fontanero@asadasanjuan.cr',
      role: Role.FONTANERO,
      name: 'Fontanero',
    });

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });
});
