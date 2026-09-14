import { Role } from '../../common/enums/role.enum';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { usuarioEsFontaneroAsignable } from './averias.fontanero-asignable';

describe('usuarioEsFontaneroAsignable (PBI 2.4)', () => {
  const conRol = (nombre: Role, activo = true): Usuario => {
    const rol = new Rol();
    rol.nombre = nombre;
    const usuario = new Usuario();
    usuario.idUsuario = 12;
    usuario.activo = activo;
    usuario.rol = rol;
    return usuario;
  };

  it('acepta un Usuario activo con rol FONTANERO', () => {
    expect(usuarioEsFontaneroAsignable(conRol(Role.FONTANERO))).toBe(true);
  });

  it('rechaza Secretaria, Administradora, inactivo o sin rol', () => {
    expect(usuarioEsFontaneroAsignable(conRol(Role.SECRETARIA))).toBe(false);
    expect(usuarioEsFontaneroAsignable(conRol(Role.ADMINISTRADORA))).toBe(
      false,
    );
    expect(usuarioEsFontaneroAsignable(conRol(Role.FONTANERO, false))).toBe(
      false,
    );
    const sinRol = new Usuario();
    sinRol.idUsuario = 3;
    sinRol.activo = true;
    expect(usuarioEsFontaneroAsignable(sinRol)).toBe(false);
  });
});
