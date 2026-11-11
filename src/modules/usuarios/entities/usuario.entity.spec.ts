import { getMetadataArgsStorage } from 'typeorm';
import { Role } from '../../../common/enums/role.enum';
import { hashPassword, verifyPassword } from '../../auth/password.util';
import { Usuario } from './usuario.entity';

describe('Usuario entity — contrato de autenticación', () => {
  const columns = getMetadataArgsStorage().columns.filter(
    (column) => column.target === Usuario,
  );
  const columnByProperty = Object.fromEntries(
    columns.map((column) => [column.propertyName, column]),
  );

  it('mapea la tabla Usuario con PK idUsuario', () => {
    const table = getMetadataArgsStorage().tables.find(
      (item) => item.target === Usuario,
    );
    expect(table?.name).toBe('Usuario');
    expect(columnByProperty.idUsuario?.mode).toBe('regular');
    expect(columnByProperty.idUsuario?.options).toEqual(
      expect.objectContaining({}),
    );
    const generated = getMetadataArgsStorage().generations.find(
      (item) => item.target === Usuario && item.propertyName === 'idUsuario',
    );
    expect(generated).toBeDefined();
  });

  it('expone correo único como identificador de login', () => {
    expect(columnByProperty.correo?.options).toEqual(
      expect.objectContaining({
        type: 'varchar',
        length: 150,
        unique: true,
      }),
    );
  });

  it('almacena passwordHash con select:false y longitud suficiente para bcrypt', () => {
    expect(columnByProperty.passwordHash?.options).toEqual(
      expect.objectContaining({
        type: 'varchar',
        length: 255,
        select: false,
      }),
    );
    expect(columnByProperty.password).toBeUndefined();
  });

  it('tiene activo e idRol (relación con Rol)', () => {
    expect(columnByProperty.activo?.options).toEqual(
      expect.objectContaining({ default: true }),
    );
    expect(columnByProperty.idRol?.options).toEqual(
      expect.objectContaining({ type: 'int' }),
    );
    const relation = getMetadataArgsStorage().relations.find(
      (item) => item.target === Usuario && item.propertyName === 'rol',
    );
    expect(relation?.relationType).toBe('many-to-one');
  });

  it('normaliza el correo a minúsculas sin espacios', () => {
    const usuario = new Usuario();
    usuario.correo = '  Admin@AsadaSanJuan.CR ';
    usuario.normalizarCorreo();
    expect(usuario.correo).toBe('admin@asadasanjuan.cr');
  });

  it('persiste hash bcrypt distinto de la contraseña original', async () => {
    const plain = 'Password123!';
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(hash.startsWith('$2')).toBe(true);
    expect(await verifyPassword(plain, hash)).toBe(true);
    expect(await verifyPassword('WrongPass1', hash)).toBe(false);

    const usuario = new Usuario();
    usuario.nombre = 'Prueba';
    usuario.correo = 'prueba@asadasanjuan.cr';
    usuario.passwordHash = hash;
    usuario.activo = true;
    usuario.idRol = 1;
    expect(usuario.passwordHash).not.toBe(plain);
    expect(usuario.rol).toBeUndefined();
    expect(Object.values(Role)).toContain(Role.ADMINISTRADORA);
  });
});
