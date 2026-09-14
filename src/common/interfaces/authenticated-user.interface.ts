import { Role } from '../enums/role.enum';

/** Usuario que deja JwtStrategy en request.user tras validar el token. */
export interface AuthenticatedUser {
  userId: string;
  /** Presente cuando `sub` es el idUsuario numérico persistido. */
  idUsuario?: number;
  email: string;
  role: Role;
  name?: string;
}
