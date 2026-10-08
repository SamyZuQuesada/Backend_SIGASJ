import { getMetadataArgsStorage } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Colaborador } from './colaborador.entity';

describe('Colaborador Entity (SIGASJ)', () => {
  describe('Instanciación y asignación de campos', () => {
    it('debe permitir instanciar y asignar todos los atributos', () => {
      const colaborador = new Colaborador();
      const createdAt = new Date('2026-10-08T08:00:00Z');
      const updatedAt = new Date('2026-10-08T09:00:00Z');

      colaborador.id = 1;
      colaborador.nombre = 'Carlos';
      colaborador.apellidos = 'Pérez Mora';
      colaborador.cedula = '1-1234-0567';
      colaborador.correoElectronico = 'carlos.perez@asadasanjuan.cr';
      colaborador.cargo = 'Fontanero';
      colaborador.activo = true;
      colaborador.usuarioId = 5;
      colaborador.createdAt = createdAt;
      colaborador.updatedAt = updatedAt;

      expect(colaborador.id).toBe(1);
      expect(colaborador.nombre).toBe('Carlos');
      expect(colaborador.apellidos).toBe('Pérez Mora');
      expect(colaborador.cedula).toBe('1-1234-0567');
      expect(colaborador.correoElectronico).toBe(
        'carlos.perez@asadasanjuan.cr',
      );
      expect(colaborador.cargo).toBe('Fontanero');
      expect(colaborador.activo).toBe(true);
      expect(colaborador.usuarioId).toBe(5);
      expect(colaborador.createdAt).toEqual(createdAt);
      expect(colaborador.updatedAt).toEqual(updatedAt);
    });

    it('debe representar fontaneros y personal administrativo', () => {
      const fontanero = new Colaborador();
      fontanero.cargo = 'Fontanero';

      const administrativa = new Colaborador();
      administrativa.cargo = 'Administradora';

      expect(fontanero.cargo).toBe('Fontanero');
      expect(administrativa.cargo).toBe('Administradora');
    });

    it('debe permitir existir sin cuenta de usuario', () => {
      const colaborador = new Colaborador();
      colaborador.usuarioId = null;
      colaborador.usuario = null;

      expect(colaborador.usuarioId).toBeNull();
      expect(colaborador.usuario).toBeNull();
    });

    it('debe manejar el estado activo/inactivo', () => {
      const colaborador = new Colaborador();
      colaborador.activo = false;
      expect(colaborador.activo).toBe(false);
    });
  });

  describe('Hooks de ciclo de vida', () => {
    it('debe dejar activo en true por defecto al insertar', () => {
      const colaborador = new Colaborador();
      colaborador.asignarValoresPorDefecto();
      expect(colaborador.activo).toBe(true);
    });

    it('debe respetar activo en false si ya fue provisto', () => {
      const colaborador = new Colaborador();
      colaborador.activo = false;
      colaborador.asignarValoresPorDefecto();
      expect(colaborador.activo).toBe(false);
    });

    it('debe normalizar textos con trim y correo a minúsculas', () => {
      const colaborador = new Colaborador();
      colaborador.nombre = '  Ana  ';
      colaborador.apellidos = '  Solís Vega  ';
      colaborador.cedula = '  2-0456-0789  ';
      colaborador.correoElectronico = '  Ana.Solis@ASADASANJUAN.CR  ';
      colaborador.cargo = '  Administradora  ';

      colaborador.normalizar();

      expect(colaborador.nombre).toBe('Ana');
      expect(colaborador.apellidos).toBe('Solís Vega');
      expect(colaborador.cedula).toBe('2-0456-0789');
      expect(colaborador.correoElectronico).toBe('ana.solis@asadasanjuan.cr');
      expect(colaborador.cargo).toBe('Administradora');
    });
  });

  describe('Metadatos de TypeORM', () => {
    const storage = getMetadataArgsStorage();
    const columna = (propertyName: string) =>
      storage.columns.find(
        (c) => c.target === Colaborador && c.propertyName === propertyName,
      );

    it('debe estar registrada como entidad "Colaborador"', () => {
      const table = storage.tables.find((t) => t.target === Colaborador);
      expect(table?.name).toBe('Colaborador');
    });

    it('debe definir la llave primaria autoincremental "id"', () => {
      const generation = storage.generations.find(
        (g) => g.target === Colaborador && g.propertyName === 'id',
      );
      expect(columna('id')?.options.primary).toBe(true);
      expect(generation?.strategy).toBe('increment');
    });

    it('debe definir todos los campos del modelo', () => {
      const columnNames = storage.columns
        .filter((c) => c.target === Colaborador)
        .map((c) => c.propertyName);

      expect(columnNames).toEqual(
        expect.arrayContaining([
          'id',
          'nombre',
          'apellidos',
          'cedula',
          'correoElectronico',
          'cargo',
          'activo',
          'usuarioId',
          'createdAt',
          'updatedAt',
        ]),
      );
    });

    it('debe configurar cédula única', () => {
      const indice = storage.indices.find(
        (i) => i.target === Colaborador && i.name === 'UQ_Colaborador_cedula',
      );
      expect(indice?.unique).toBe(true);
      expect(indice?.columns).toEqual(['cedula']);
      expect(columna('cedula')?.options.length).toBe(30);
    });

    it('debe configurar activo con valor default true', () => {
      expect(columna('activo')?.options.default).toBe(true);
    });

    it('debe configurar usuarioId como opcional', () => {
      expect(columna('usuarioId')?.options.nullable).toBe(true);
    });

    it('debe relacionarse opcionalmente con Usuario', () => {
      const relacion = storage.relations.find(
        (r) => r.target === Colaborador && r.propertyName === 'usuario',
      );
      expect(relacion).toBeDefined();
      expect(relacion?.relationType).toBe('many-to-one');
      expect((relacion?.type as () => unknown)()).toBe(Usuario);
      expect(relacion?.options.nullable).toBe(true);
      expect(relacion?.options.onDelete).toBe('SET NULL');

      const joinColumn = storage.joinColumns.find(
        (j) => j.target === Colaborador && j.propertyName === 'usuario',
      );
      expect(joinColumn?.name).toBe('usuarioId');
      expect(joinColumn?.referencedColumnName).toBe('idUsuario');
      expect(joinColumn?.foreignKeyConstraintName).toBe(
        'FK_Colaborador_Usuario',
      );
    });

    it('debe impedir que una misma cuenta de usuario se asigne a dos colaboradores', () => {
      const indice = storage.indices.find(
        (i) =>
          i.target === Colaborador && i.name === 'UQ_Colaborador_usuarioId',
      );
      expect(indice?.unique).toBe(true);
      expect(indice?.where).toContain('IS NOT NULL');
    });

    it('debe registrar createdAt y updatedAt automáticos', () => {
      expect(columna('createdAt')?.mode).toBe('createDate');
      expect(columna('updatedAt')?.mode).toBe('updateDate');
    });
  });
});
