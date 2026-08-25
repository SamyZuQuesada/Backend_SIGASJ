import { Role } from '../enums/role.enum';

/** Usuario que deja JwtStrategy en request.user tras validar el token. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
  name?: string;
}
