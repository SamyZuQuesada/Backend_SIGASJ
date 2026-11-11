import {
  isRole,
  parseRole,
  Role,
  ROLE_LABELS,
  ROLES_OPERATIVOS_ASADA,
  ROLES_SISTEMA,
  RoleSecretaria,
} from './role.enum';

describe('Role — fuente única de roles', () => {
  it('incluye exactamente los roles de sistema aprobados (+ adicionales legítimos)', () => {
    expect(ROLES_SISTEMA).toEqual([
      Role.ADMINISTRADORA,
      Role.SECRETARIA_EJECUTIVA,
      Role.FONTANERO,
      Role.ABONADO,
      Role.AYUDANTE,
    ]);
    expect(new Set(ROLES_SISTEMA).size).toBe(ROLES_SISTEMA.length);
  });

  it('roles operativos ASADA: Administradora, Secretaria Ejecutiva, Fontanero', () => {
    expect(ROLES_OPERATIVOS_ASADA).toEqual([
      Role.ADMINISTRADORA,
      Role.SECRETARIA_EJECUTIVA,
      Role.FONTANERO,
    ]);
  });

  it('valores persistidos/JWT son estables (UPPER_SNAKE)', () => {
    expect(Role.ADMINISTRADORA).toBe('ADMINISTRADORA');
    expect(Role.SECRETARIA_EJECUTIVA).toBe('SECRETARIA');
    expect(Role.FONTANERO).toBe('FONTANERO');
  });

  it('labels de dominio no se usan como valor de autorización', () => {
    expect(ROLE_LABELS[Role.ADMINISTRADORA]).toBe('Administradora');
    expect(ROLE_LABELS[Role.SECRETARIA_EJECUTIVA]).toBe('Secretaria Ejecutiva');
    expect(ROLE_LABELS[Role.FONTANERO]).toBe('Fontanero');
    expect(Role.SECRETARIA_EJECUTIVA).not.toBe('Secretaria Ejecutiva');
    expect(Role.SECRETARIA_EJECUTIVA).not.toBe('Secretaria');
  });

  it('RoleSecretaria es alias del valor canónico SECRETARIA_EJECUTIVA', () => {
    expect(RoleSecretaria).toBe(Role.SECRETARIA_EJECUTIVA);
    expect(RoleSecretaria).toBe('SECRETARIA');
  });

  it('parseRole es estricto: no acepta variantes inconsistentes', () => {
    expect(parseRole('SECRETARIA')).toBe(Role.SECRETARIA_EJECUTIVA);
    expect(parseRole('Secretaria')).toBeNull();
    expect(parseRole('Secretaria Ejecutiva')).toBeNull();
    expect(parseRole('SecretariaEjecutiva')).toBeNull();
    expect(parseRole('ADMIN')).toBeNull();
    expect(parseRole('admin')).toBeNull();
    expect(parseRole('Administradora')).toBeNull();
    expect(isRole(Role.FONTANERO)).toBe(true);
    expect(isRole('FONTANERO ')).toBe(false);
  });
});
