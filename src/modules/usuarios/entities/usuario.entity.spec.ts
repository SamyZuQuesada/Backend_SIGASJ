import { getMetadataArgsStorage } from 'typeorm';
import { DataSource } from 'typeorm';
import { hashPassword, verifyPassword } from '../../auth/password.util';
import { Role } from '../../../common/enums/role.enum';
import { Rol } from './rol.entity';
import { Usuario } from './usuario.entity';

describe('Usuario Entity (autenticación SIGASJ)', () => {
  it('existe una única entidad mapeada a la tabla Usuario', () => {
    const tablas = getMetadataArgsStorage().tables.filter(
      (table) => table.target === Usuario,
    );
    expect(tablas).toHaveLength(1);
    expect(tablas[0].name).toBe('Usuario');
  });

  it('expone identificador, login, hash, rol, estado y no una columna password', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (column) => column.target === Usuario,
    );
    const names = columns.map((column) => column.propertyName);
    expect(names).toEqual(
      expect.arrayContaining([
        'idUsuario',
        'correo',
        'passwordHash',
        'idRol',
        'activo',
      ]),
    );
    expect(names).not.toContain('password');
    expect(names).not.toContain('username');
    expect(names).not.toContain('createdAt');
    expect(names).not.toContain('updatedAt');

    const hash = columns.find(
      (column) => column.propertyName === 'passwordHash',
    );
    expect(hash?.options.select).toBe(false);
    expect([255, '255']).toContain(hash?.options.length);

    const correo = columns.find((column) => column.propertyName === 'correo');
    expect(correo?.options.unique).toBe(true);
    expect([150, '150']).toContain(correo?.options.length);
  });

  it('relaciona Usuario con Rol por idRol', () => {
    const relations = getMetadataArgsStorage().relations.filter(
      (relation) => relation.target === Usuario,
    );
    expect(relations).toHaveLength(1);
    expect(relations[0].propertyName).toBe('rol');
    expect(relations[0].relationType).toBe('many-to-one');
  });

  it('permite asignar identificador, hash, rol y estado', () => {
    const usuario = new Usuario();
    usuario.idUsuario = 5;
    usuario.nombre = 'Carlos Pérez';
    usuario.correo = 'carlos@asadasanjuan.cr';
    usuario.passwordHash = '$2b$10$placeholderhash';
    usuario.activo = true;
    usuario.idRol = 3;

    expect(usuario.idUsuario).toBe(5);
    expect(usuario.correo).toBe('carlos@asadasanjuan.cr');
    expect(usuario.passwordHash).toContain('$2b$');
    expect(usuario.activo).toBe(true);
    expect(usuario.idRol).toBe(3);
  });

  it('normaliza el correo de login a minúsculas sin espacios', () => {
    const usuario = new Usuario();
    usuario.correo = '  Admin@ASADASanJuan.CR ';
    usuario.normalizarCorreo();
    expect(usuario.correo).toBe('admin@asadasanjuan.cr');
  });

  it('toJSON no incluye passwordHash', () => {
    const usuario = new Usuario();
    usuario.idUsuario = 8;
    usuario.nombre = 'Secretaria';
    usuario.correo = 'secretaria@asadasanjuan.cr';
    usuario.passwordHash = 'no-debe-salir';
    usuario.activo = true;
    usuario.idRol = 2;

    const serialized = JSON.stringify(usuario);
    expect(serialized).not.toMatch(/passwordHash/i);
    expect(serialized).not.toContain('no-debe-salir');
    expect(JSON.parse(serialized)).toMatchObject({
      idUsuario: 8,
      correo: 'secretaria@asadasanjuan.cr',
      activo: true,
    });
  });
});

describe('Usuario persistencia auth (sqljs)', () => {
  jest.setTimeout(30_000);
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqljs',
      autoSave: false,
      dropSchema: true,
      entities: [Usuario, Rol],
      synchronize: true,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('almacena bcrypt distinto a la contraseña original y oculta el hash en find()', async () => {
    const roles = dataSource.getRepository(Rol);
    const usuarios = dataSource.getRepository(Usuario);
    const rol = await roles.save(roles.create({ nombre: Role.FONTANERO }));
    const plain = 'Password123!';
    const passwordHash = await hashPassword(plain);

    expect(passwordHash).not.toBe(plain);
    expect(await verifyPassword(plain, passwordHash)).toBe(true);
    expect(await verifyPassword('otra', passwordHash)).toBe(false);

    const guardado = await usuarios.save(
      usuarios.create({
        nombre: 'Carlos Pérez',
        correo: '  Carlos@ASADASanJuan.CR ',
        passwordHash,
        activo: true,
        idRol: rol.idRol,
      }),
    );

    const listado = await usuarios.findOne({
      where: { idUsuario: guardado.idUsuario },
      relations: { rol: true },
    });
    expect(listado?.correo).toBe('carlos@asadasanjuan.cr');
    expect(listado?.activo).toBe(true);
    expect(listado?.rol.nombre).toBe(Role.FONTANERO);
    expect(listado?.passwordHash).toBeUndefined();
    expect(JSON.stringify(listado)).not.toMatch(/passwordHash/i);

    const conHash = await usuarios
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .where('usuario.idUsuario = :id', { id: guardado.idUsuario })
      .getOne();
    expect(conHash?.passwordHash).toBeDefined();
    expect(conHash?.passwordHash).not.toBe(plain);
    expect(JSON.stringify(conHash)).not.toMatch(/passwordHash/i);
  });

  it('rechaza correo duplicado como identificador de login', async () => {
    const roles = dataSource.getRepository(Rol);
    const usuarios = dataSource.getRepository(Usuario);
    const rol = await roles.findOneByOrFail({ nombre: Role.FONTANERO });
    const passwordHash = await hashPassword('Password123!');

    await usuarios.save(
      usuarios.create({
        nombre: 'Uno',
        correo: 'unico.auth@asadasanjuan.cr',
        passwordHash,
        activo: true,
        idRol: rol.idRol,
      }),
    );

    await expect(
      usuarios.save(
        usuarios.create({
          nombre: 'Dos',
          correo: 'unico.auth@asadasanjuan.cr',
          passwordHash,
          activo: true,
          idRol: rol.idRol,
        }),
      ),
    ).rejects.toThrow();
  });
});
