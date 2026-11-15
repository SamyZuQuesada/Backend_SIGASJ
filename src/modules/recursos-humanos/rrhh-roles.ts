import { Role } from '../../common/enums/role.enum';

/** Roles con paridad operativa en el módulo de Recursos Humanos. */
export const RRHH_ADMIN_ROLES = [
  Role.ADMINISTRADORA,
  Role.SECRETARIA_EJECUTIVA,
] as const;
