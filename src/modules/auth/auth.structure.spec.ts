import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RequestMethod } from '@nestjs/common';
import { Role } from '../../common/enums/role.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PasswordService } from './password.service';

type ConstructorConsulta = {
  leftJoinAndSelect: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  getOne: jest.Mock;
};

describe('Estructura de AuthModule', () => {
  const consulta: ConstructorConsulta = {
    leftJoinAndSelect: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    getOne: jest.fn(),
  };
  const usuarioRepository = {
    createQueryBuilder: jest.fn(() => consulta),
  };
  const passwordService = {
    compare: jest.fn(),
    hash: jest.fn(),
  };
  const jwtService = {
    sign: jest.fn(() => 'token-prueba'),
  };
  const configService = {
    get: jest.fn(() => false),
  };

  let authService: AuthService;
  let authController: AuthController;

  const usuarioAuth = (
    parcial: Partial<Usuario> & { rolNombre: Role | string },
  ): Usuario =>
    ({
      idUsuario: 7,
      nombre: 'QA Auth',
      correo: 'qa.auth@sigasj.test',
      activo: true,
      idRol: 3,
      passwordHash: 'hash-interno',
      rol: { nombre: parcial.rolNombre },
      ...parcial,
    }) as Usuario;

  beforeEach(async () => {
    consulta.leftJoinAndSelect.mockReturnThis();
    consulta.addSelect.mockReturnThis();
    consulta.where.mockReturnThis();
    consulta.getOne.mockReset();
    passwordService.compare.mockReset();
    jwtService.sign.mockClear();
    configService.get.mockReset();
    configService.get.mockReturnValue(false);

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: PasswordService, useValue: passwordService },
        { provide: getRepositoryToken(Usuario), useValue: usuarioRepository },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
    authController = moduleRef.get(AuthController);
  });

  it('registra el controller en auth, no en api/auth', () => {
    const login = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'login',
    )?.value as object;

    expect(Reflect.getMetadata(PATH_METADATA, AuthController)).toBe('auth');
    expect(Reflect.getMetadata(PATH_METADATA, login)).toBe('login');
    expect(Reflect.getMetadata(METHOD_METADATA, login)).toBe(
      RequestMethod.POST,
    );
  });

  it('el controller delega el DTO y devuelve el resultado del servicio', async () => {
    const resultado = {
      accessToken: 'token-prueba',
      user: {
        id: 7,
        email: 'qa.auth@sigasj.test',
        role: Role.FONTANERO,
        name: 'QA Auth',
      },
    };
    const delegar = jest
      .spyOn(authService, 'login')
      .mockResolvedValue(resultado);
    const dto: LoginDto = {
      email: 'qa.auth@sigasj.test',
      password: 'ClavePrueba1',
    };

    await expect(authController.login(dto)).resolves.toBe(resultado);
    expect(delegar).toHaveBeenCalledTimes(1);
    expect(delegar).toHaveBeenCalledWith(dto);
  });

  it('Nest resuelve AuthService y AuthController por inyección', () => {
    expect(authService).toBeInstanceOf(AuthService);
    expect(authController).toBeInstanceOf(AuthController);
  });

  it('usuario inexistente y contraseña incorrecta comparten el mismo rechazo', async () => {
    consulta.getOne.mockResolvedValue(null);
    const dto: LoginDto = {
      email: 'qa.auth@sigasj.test',
      password: 'ClavePrueba1',
    };

    await expect(authService.login(dto)).rejects.toThrow(UnauthorizedException);
    await expect(authService.login(dto)).rejects.toThrow(
      'Credenciales inválidas',
    );
    expect(passwordService.compare).not.toHaveBeenCalled();

    consulta.getOne.mockResolvedValueOnce(
      usuarioAuth({ rolNombre: Role.FONTANERO }),
    );
    passwordService.compare.mockResolvedValueOnce(false);
    await expect(authService.login(dto)).rejects.toThrow(
      'Credenciales inválidas',
    );
    expect(passwordService.compare).toHaveBeenCalledWith(
      'ClavePrueba1',
      'hash-interno',
    );
  });

  it('rechaza la cuenta inactiva después de validar la contraseña', async () => {
    consulta.getOne.mockResolvedValue(
      usuarioAuth({ rolNombre: Role.SECRETARIA, activo: false }),
    );
    passwordService.compare.mockResolvedValue(true);

    await expect(
      authService.login({
        email: 'qa.auth@sigasj.test',
        password: 'ClavePrueba1',
      }),
    ).rejects.toThrow('El usuario se encuentra inactivo.');
  });

  it('devuelve el rol central y omite el hash', async () => {
    consulta.getOne.mockResolvedValue(
      usuarioAuth({ rolNombre: Role.ADMINISTRADORA }),
    );
    passwordService.compare.mockResolvedValue(true);

    const respuesta = await authService.login({
      email: ' QA.AUTH@sigasj.test ',
      password: 'ClavePrueba1',
    });

    expect(respuesta.user.role).toBe(Role.ADMINISTRADORA);
    expect(respuesta).not.toHaveProperty('passwordHash');
    expect(respuesta.user).not.toHaveProperty('password');
    expect(JSON.stringify(respuesta)).not.toMatch(/passwordHash|hash-interno/i);
    expect(consulta.addSelect).toHaveBeenCalledWith('usuario.passwordHash');
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 7,
        role: Role.ADMINISTRADORA,
        email: 'qa.auth@sigasj.test',
      }),
    );
  });

  it('rechaza una etiqueta de rol que no es el código persistido', async () => {
    consulta.getOne.mockResolvedValue(
      usuarioAuth({ rolNombre: 'Secretaria Ejecutiva' }),
    );
    passwordService.compare.mockResolvedValue(true);

    await expect(
      authService.login({
        email: 'qa.auth@sigasj.test',
        password: 'ClavePrueba1',
      }),
    ).rejects.toThrow('Credenciales inválidas');
    expect(jwtService.sign).not.toHaveBeenCalled();
  });
});
