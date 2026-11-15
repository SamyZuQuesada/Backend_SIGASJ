import { esRol, ROLE_ETIQUETA, Role, ROLES_SISTEMA } from './role.enum';

describe('Role (fuente única)', () => {
  it('incluye los tres roles funcionales con el código persistido', () => {
    expect(Role.ADMINISTRADORA).toBe('ADMINISTRADORA');
    expect(Role.SECRETARIA).toBe('SECRETARIA');
    expect(Role.FONTANERO).toBe('FONTANERO');
    expect(ROLE_ETIQUETA[Role.ADMINISTRADORA]).toBe('Administradora');
    expect(ROLE_ETIQUETA[Role.SECRETARIA]).toBe('Secretaria Ejecutiva');
    expect(ROLE_ETIQUETA[Role.FONTANERO]).toBe('Fontanero');
  });

  it('conserva ABONADO y AYUDANTE sin tratarlos como roles nuevos de esta tarea', () => {
    expect(ROLES_SISTEMA).toEqual([
      Role.ADMINISTRADORA,
      Role.SECRETARIA,
      Role.FONTANERO,
      Role.ABONADO,
      Role.AYUDANTE,
    ]);
  });

  it('solo acepta el código exacto, no la etiqueta ni alias', () => {
    expect(esRol(Role.SECRETARIA)).toBe(true);
    expect(esRol('Secretaria')).toBe(false);
    expect(esRol('Secretaria Ejecutiva')).toBe(false);
    expect(esRol('SECRETARIA_EJECUTIVA')).toBe(false);
    expect(esRol('admin')).toBe(false);
    expect(esRol('ADMIN')).toBe(false);
    expect(esRol(undefined)).toBe(false);
    expect(esRol('')).toBe(false);
  });
});
