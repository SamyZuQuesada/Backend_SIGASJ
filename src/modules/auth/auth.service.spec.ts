import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '../../common/enums/role.enum';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtSign: jest.Mock;
  let configGet: jest.Mock;

  beforeEach(async () => {
    jwtSign = jest.fn().mockReturnValue('signed-jwt');
    configGet = jest.fn().mockReturnValue('development');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: { sign: jwtSign },
        },
        {
          provide: ConfigService,
          useValue: { get: configGet },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('login emite JWT con rol ADMINISTRADORA', () => {
    const response = service.login({
      email: 'admin@sigasj.local',
      password: 'secret',
    });

    expect(jwtSign).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@sigasj.local',
        role: Role.ADMINISTRADORA,
      }),
    );
    expect(response.accessToken).toBe('signed-jwt');
    expect(response.user.role).toBe(Role.ADMINISTRADORA);
  });

  it('devToken emite JWT para rol interno en desarrollo', () => {
    const response = service.devToken({ rol: 'Secretaria' });

    expect(jwtSign).toHaveBeenCalledWith(
      expect.objectContaining({
        role: Role.SECRETARIA,
      }),
    );
    expect(response.user.role).toBe(Role.SECRETARIA);
    expect(response.user.name).toBe('Usuario Secretaria');
  });

  it('devToken rechaza uso en producción', () => {
    configGet.mockReturnValue('production');

    expect(() => service.devToken({ rol: 'Administradora' })).toThrow(
      ForbiddenException,
    );
  });
});
