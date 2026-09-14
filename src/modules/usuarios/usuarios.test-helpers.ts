import { Repository } from 'typeorm';
import { Role, ROLES_SISTEMA } from '../../common/enums/role.enum';
import { hashPassword } from '../auth/password.util';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';

export const PASSWORD_PRUEBA = 'Password123!';

export async function seedRolesBase(
  roles: Repository<Rol>,
): Promise<Record<Role, Rol>> {
  const map = {} as Record<Role, Rol>;
  for (const nombre of ROLES_SISTEMA) {
    const existente = await roles.findOne({ where: { nombre } });
    map[nombre] = existente ?? (await roles.save(roles.create({ nombre })));
  }
  return map;
}

export async function crearUsuarioPrueba(
  usuarios: Repository<Usuario>,
  roles: Record<Role, Rol>,
  input: {
    nombre: string;
    correo: string;
    role: Role;
    activo?: boolean;
    password?: string;
  },
): Promise<Usuario> {
  return usuarios.save(
    usuarios.create({
      nombre: input.nombre,
      correo: input.correo.trim().toLowerCase(),
      passwordHash: await hashPassword(input.password ?? PASSWORD_PRUEBA),
      activo: input.activo ?? true,
      idRol: roles[input.role].idRol,
      rol: roles[input.role],
    }),
  );
}

/** Usuarios de login usados por los specs que aún llaman POST /auth/login. */
export async function seedStaffLoginUsers(
  usuarios: Repository<Usuario>,
  roles: Record<Role, Rol>,
): Promise<void> {
  await crearUsuarioPrueba(usuarios, roles, {
    nombre: 'Administradora',
    correo: 'admin@asadasanjuan.cr',
    role: Role.ADMINISTRADORA,
  });
  await crearUsuarioPrueba(usuarios, roles, {
    nombre: 'Secretaria',
    correo: 'secretaria@asadasanjuan.cr',
    role: Role.SECRETARIA,
  });
}
