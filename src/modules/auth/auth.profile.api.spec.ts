import { INestApplication, ValidationPipe } from '@nestjs/common';
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

describe('Auth perfil self-service', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  const secret = 'super_secret_jwt_key_sigasj_2026';

  const usuariosService = {
    findByIdForAuth: jest.fn(),
    findByCorreoForAuth: jest.fn(),
    updateOwnNombre: jest.fn(),
    changeOwnPassword: jest.fn(),
    updateOwnFoto: jest.fn(),
    clearOwnFoto: jest.fn(),
  };

  const passwordService = {
    comparePassword: jest.fn(),
    hashPassword: jest.fn(),
  };

  const baseUsuario = {
    idUsuario: 7,
    correo: 'fontanero@asadasanjuan.cr',
    nombre: 'Fontanero',
    activo: true,
    fotoPerfilUrl: null as string | null,
    rol: { nombre: Role.FONTANERO },
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
        { provide: PasswordService, useValue: passwordService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuariosService.findByIdForAuth.mockResolvedValue({ ...baseUsuario });
  });

  const tokenFor = () =>
    jwtService.sign({
      sub: 7,
      email: 'fontanero@asadasanjuan.cr',
      role: Role.FONTANERO,
      name: 'Fontanero',
    });

  it('PATCH /auth/me actualiza el nombre', async () => {
    usuariosService.updateOwnNombre.mockResolvedValue({
      ...baseUsuario,
      nombre: 'Carlos Fontanero',
    });

    const response = await request(app.getHttpServer())
      .patch('/auth/me')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({ name: 'Carlos Fontanero' })
      .expect(200);

    expect(usuariosService.updateOwnNombre).toHaveBeenCalledWith(
      7,
      'Carlos Fontanero',
    );
    expect(response.body).toMatchObject({
      id: 7,
      name: 'Carlos Fontanero',
      avatar: null,
    });
  });

  it('PATCH /auth/me con nombre vacío → 400', async () => {
    await request(app.getHttpServer())
      .patch('/auth/me')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({ name: '   ' })
      .expect(400);
  });

  it('POST /auth/me/password con contraseña actual incorrecta → 401', async () => {
    const { UnauthorizedException } = await import('@nestjs/common');
    usuariosService.changeOwnPassword.mockRejectedValue(
      new UnauthorizedException('La contraseña actual no es correcta.'),
    );

    await request(app.getHttpServer())
      .post('/auth/me/password')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({
        currentPassword: 'wrong-pass',
        newPassword: 'nuevaClave1',
      })
      .expect(401);
  });

  it('POST /auth/me/password actualiza con éxito', async () => {
    usuariosService.changeOwnPassword.mockResolvedValue(undefined);

    const response = await request(app.getHttpServer())
      .post('/auth/me/password')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({
        currentPassword: 'Password123!',
        newPassword: 'NuevaClave9',
      })
      .expect(200);

    expect(usuariosService.changeOwnPassword).toHaveBeenCalledWith(
      7,
      'Password123!',
      'NuevaClave9',
    );
    expect(response.body).toEqual({ ok: true });
  });

  it('DELETE /auth/me/avatar es idempotente', async () => {
    usuariosService.clearOwnFoto.mockResolvedValue({
      ...baseUsuario,
      fotoPerfilUrl: null,
    });

    const response = await request(app.getHttpServer())
      .delete('/auth/me/avatar')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .expect(200);

    expect(response.body.avatar).toBeNull();
  });

  it('GET /auth/me incluye avatar cuando existe', async () => {
    usuariosService.findByIdForAuth.mockResolvedValue({
      ...baseUsuario,
      fotoPerfilUrl: '/uploads/perfiles/demo.jpg',
    });

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .expect(200);

    expect(response.body.avatar).toBe('/uploads/perfiles/demo.jpg');
  });
});
