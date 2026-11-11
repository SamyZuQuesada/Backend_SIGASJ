import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { RolesGuard } from './roles.guard';

describe('RolesGuard — 401 vs 403 + multi-rol', () => {
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

  it('Secretaria Ejecutiva (valor JWT SECRETARIA) en ruta exclusiva Admin → 403', () => {
    expect(() =>
      guard.canActivate(ctx({ role: Role.SECRETARIA_EJECUTIVA })),
    ).toThrow(ForbiddenException);
  });

  it('multi-rol: Administradora y Secretaria Ejecutiva permitidos; Fontanero 403', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      Role.ADMINISTRADORA,
      Role.SECRETARIA_EJECUTIVA,
    ]);
    expect(guard.canActivate(ctx({ role: Role.ADMINISTRADORA }))).toBe(true);
    expect(guard.canActivate(ctx({ role: Role.SECRETARIA_EJECUTIVA }))).toBe(
      true,
    );
    expect(() => guard.canActivate(ctx({ role: Role.FONTANERO }))).toThrow(
      ForbiddenException,
    );
  });

  it('no acepta string inconsistente como rol válido vía includes parcial', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      Role.ADMINISTRADORA,
    ]);
    expect(() =>
      guard.canActivate(ctx({ role: 'Administradora' as unknown as Role })),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(ctx({ role: 'admin' as unknown as Role })),
    ).toThrow(ForbiddenException);
  });
});
