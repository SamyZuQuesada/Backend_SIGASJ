import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '../../common/enums/role.enum';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

describe('AuthService — validación segura de credenciales', () => {
  let service: AuthService;
  let usuariosService: { findByCorreoForAuth: jest.Mock };
  let passwordService: { comparePassword: jest.Mock };
  let jwtService: { sign: jest.Mock };
  let configService: { get: jest.Mock };

  const userBase = {
    idUsuario: 10,
    correo: 'ok@test.local',
    nombre: 'Usuario OK',
    activo: true,
    passwordHash: 'hash-sintetico',
    rol: { nombre: Role.ADMINISTRADORA },
  };

  beforeEach(async () => {
    usuariosService = { findByCorreoForAuth: jest.fn() };
    passwordService = { comparePassword: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue('jwt-existente') };
    configService = { get: jest.fn().mockReturnValue(false) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: PasswordService, useValue: passwordService },
        { provide: UsuariosService, useValue: usuariosService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('se instancia vía DI Nest', () => {
    expect(service).toBeDefined();
  });

  it('credenciales válidas → datos mínimos + JWT; sin hash/password', async () => {
    usuariosService.findByCorreoForAuth.mockResolvedValue(userBase);
    passwordService.comparePassword.mockResolvedValue(true);

    const result = await service.login({
      email: '  OK@test.local ',
      password: 'Secret1!',
    });

    expect(usuariosService.findByCorreoForAuth).toHaveBeenCalledWith(
      'ok@test.local',
      { includePasswordHash: true },
    );
    expect(passwordService.comparePassword).toHaveBeenCalledTimes(1);
    expect(passwordService.comparePassword.mock.calls[0]).toHaveLength(2);
    expect(result.accessToken).toBe('jwt-existente');
    expect(result.user).toEqual({
      id: 10,
      email: 'ok@test.local',
      role: Role.ADMINISTRADORA,
      name: 'Usuario OK',
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('password');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(result)).not.toMatch(/passwordHash|hash-sintetico/);
  });

  it('usuario inexistente → 401 genérico; PasswordService no se llama', async () => {
    usuariosService.findByCorreoForAuth.mockResolvedValue(null);
    let caught: unknown;
    try {
      await service.login({ email: 'x@test.local', password: 'Secret1!' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UnauthorizedException);
    expect((caught as UnauthorizedException).getResponse()).toEqual(
      expect.objectContaining({
        message: 'Credenciales inválidas',
        statusCode: 401,
      }),
    );
    expect(passwordService.comparePassword).not.toHaveBeenCalled();
  });

  it('password incorrecta usa el mismo mensaje que usuario inexistente', async () => {
    usuariosService.findByCorreoForAuth.mockResolvedValue(userBase);
    passwordService.comparePassword.mockResolvedValue(false);

    let wrongMsg: unknown;
    try {
      await service.login({ email: 'ok@test.local', password: 'Wrong1!' });
    } catch (error) {
      wrongMsg = (error as UnauthorizedException).getResponse();
    }

    usuariosService.findByCorreoForAuth.mockResolvedValue(null);
    let missingMsg: unknown;
    try {
      await service.login({ email: 'no@test.local', password: 'Wrong1!' });
    } catch (error) {
      missingMsg = (error as UnauthorizedException).getResponse();
    }

    expect(wrongMsg).toEqual(missingMsg);
    expect(wrongMsg).toEqual(
      expect.objectContaining({
        message: 'Credenciales inválidas',
        statusCode: 401,
      }),
    );
  });

  it('hash ausente → rechazo controlado (sin crash)', async () => {
    usuariosService.findByCorreoForAuth.mockResolvedValue({
      ...userBase,
      passwordHash: undefined,
    });
    await expect(
      service.login({ email: 'ok@test.local', password: 'Secret1!' }),
    ).rejects.toThrow('Credenciales inválidas');
    expect(passwordService.comparePassword).not.toHaveBeenCalled();
  });

  it('cuenta inactiva → rechazo explícito tras password correcta', async () => {
    usuariosService.findByCorreoForAuth.mockResolvedValue({
      ...userBase,
      activo: false,
      rol: { nombre: Role.FONTANERO },
    });
    passwordService.comparePassword.mockResolvedValue(true);

    await expect(
      service.login({ email: 'ok@test.local', password: 'Secret1!' }),
    ).rejects.toThrow('El usuario se encuentra inactivo.');
  });

  it.each([
    [Role.ADMINISTRADORA, 'Administradora'],
    [Role.SECRETARIA_EJECUTIVA, 'Secretaria Ejecutiva'],
    [Role.FONTANERO, 'Fontanero'],
  ] as const)(
    'rol %s proviene de Usuario (definición central)',
    async (role) => {
      usuariosService.findByCorreoForAuth.mockResolvedValue({
        ...userBase,
        rol: { nombre: role },
      });
      passwordService.comparePassword.mockResolvedValue(true);

      const validated = await service.validateCredentials({
        email: 'ok@test.local',
        password: 'Secret1!',
      });
      expect(validated.role).toBe(role);
      expect(validated).not.toHaveProperty('passwordHash');
    },
  );

  it('rol inválido en BD → Credenciales inválidas', async () => {
    usuariosService.findByCorreoForAuth.mockResolvedValue({
      ...userBase,
      rol: { nombre: 'NO_ES_UN_ROL' },
    });
    passwordService.comparePassword.mockResolvedValue(true);

    await expect(
      service.login({ email: 'ok@test.local', password: 'Secret1!' }),
    ).rejects.toThrow('Credenciales inválidas');
  });
});
