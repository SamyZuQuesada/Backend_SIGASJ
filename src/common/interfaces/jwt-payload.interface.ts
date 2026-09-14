import { Role } from '../enums/role.enum';

export interface JwtPayload {
  /** idUsuario persistido. Login real usa número; tokens de prueba pueden usar string. */
  sub: string | number;
  email: string;
  role: Role;
  name?: string;
}
