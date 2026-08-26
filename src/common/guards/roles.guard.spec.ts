import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { RolesGuard } from './roles.guard';

describe('RolesGuard — 401 vs 403', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  const ctx = (user?: { role?: Role }) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      Role.ADMINISTRADORA,
    ]);
  });

  it('sin usuario autenticado responde UnauthorizedException (401)', () => {
    expect(() => guard.canActivate(ctx(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('usuario autenticado sin rol autorizado responde ForbiddenException (403)', () => {
    expect(() => guard.canActivate(ctx({ role: Role.FONTANERO }))).toThrow(
      ForbiddenException,
    );
  });

  it('Administradora autenticada puede continuar', () => {
    expect(guard.canActivate(ctx({ role: Role.ADMINISTRADORA }))).toBe(true);
  });
});
