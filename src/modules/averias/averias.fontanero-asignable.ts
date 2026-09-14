import { Role } from '../../common/enums/role.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';

export function usuarioEsFontaneroAsignable(usuario: Usuario): boolean {
  return usuario.activo === true && usuario.rol?.nombre === Role.FONTANERO;
}
