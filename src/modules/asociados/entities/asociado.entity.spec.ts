import { getMetadataArgsStorage } from 'typeorm';
import { Asociado } from './asociado.entity';

describe('Asociado Entity (SIGASJ)', () => {
  describe('Instanciación y Asignación de Campos', () => {
    it('debe existir la clase Asociado', () => {
      expect(Asociado).toBeDefined();
    });

    it('debe permitir instanciar y asignar todos los atributos requeridos', () => {
      const asociado = new Asociado();
      const fechaRegistro = new Date('2026-01-15T08:00:00Z');
      const createdAt = new Date('2026-01-15T08:00:00Z');
      const updatedAt = new Date('2026-01-15T09:00:00Z');

      asociado.id = 1;
      asociado.nombre = 'Juan';
      asociado.apellidos = 'Pérez Rodríguez';
      asociado.cedula = '1-1234-0567';
      asociado.correoElectronico = 'juan.perez@example.com';
      asociado.activo = true;
      asociado.fechaRegistro = fechaRegistro;
      asociado.fechaInactivacion = null;
      asociado.createdAt = createdAt;
      asociado.updatedAt = updatedAt;

      expect(asociado.id).toBe(1);
      expect(asociado.nombre).toBe('Juan');
      expect(asociado.apellidos).toBe('Pérez Rodríguez');
      expect(asociado.cedula).toBe('1-1234-0567');
      expect(asociado.correoElectronico).toBe('juan.perez@example.com');
      expect(asociado.activo).toBe(true);
      expect(asociado.fechaRegistro).toEqual(fechaRegistro);
      expect(asociado.fechaInactivacion).toBeNull();
      expect(asociado.createdAt).toEqual(createdAt);
      expect(asociado.updatedAt).toEqual(updatedAt);
    });

    it('debe permitir manejar el estado activo/inactivo', () => {
      const asociadoActivo = new Asociado();
      asociadoActivo.activo = true;
      expect(asociadoActivo.activo).toBe(true);

      const asociadoInactivo = new Asociado();
      asociadoInactivo.activo = false;
      expect(asociadoInactivo.activo).toBe(false);
    });

    it('debe permitir que fechaInactivacion permanezca en null mientras el asociado está activo', () => {
      const asociado = new Asociado();
      asociado.activo = true;
      asociado.fechaInactivacion = null;

      expect(asociado.activo).toBe(true);
      expect(asociado.fechaInactivacion).toBeNull();
    });

    it('debe permitir registrar una fecha de inactivación cuando el asociado es inactivado', () => {
      const asociado = new Asociado();
      const fechaBaja = new Date('2026-05-10T14:30:00Z');
      asociado.activo = false;
      asociado.fechaInactivacion = fechaBaja;

      expect(asociado.activo).toBe(false);
      expect(asociado.fechaInactivacion).toEqual(fechaBaja);
    });
  });

  describe('Hooks de Ciclo de Vida (@BeforeInsert / @BeforeUpdate)', () => {
    it('debe asignar fechaRegistro automáticamente al insertar si no viene definida', () => {
      const asociado = new Asociado();
      expect(asociado.fechaRegistro).toBeUndefined();

      asociado.asignarValoresPorDefecto();

      expect(asociado.fechaRegistro).toBeInstanceOf(Date);
      expect(asociado.activo).toBe(true);
    });

    it('debe respetar la fechaRegistro si ya fue provista', () => {
      const asociado = new Asociado();
      const fechaEspecifica = new Date('2020-03-01T00:00:00Z');
      asociado.fechaRegistro = fechaEspecifica;

      asociado.asignarValoresPorDefecto();

      expect(asociado.fechaRegistro).toBe(fechaEspecifica);
    });

    it('debe normalizar textos con trim y correo a minúsculas', () => {
      const asociado = new Asociado();
      asociado.nombre = '  María Elena  ';
      asociado.apellidos = '  González Vargas  ';
      asociado.cedula = '  5-0123-0456  ';
      asociado.correoElectronico = '  Maria.Gonzalez@EXAMPLE.COM  ';

      asociado.normalizar();

      expect(asociado.nombre).toBe('María Elena');
      expect(asociado.apellidos).toBe('González Vargas');
      expect(asociado.cedula).toBe('5-0123-0456');
      expect(asociado.correoElectronico).toBe('maria.gonzalez@example.com');
    });
  });

  describe('Metadatos de TypeORM', () => {
    const storage = getMetadataArgsStorage();

    it('debe estar registrada como entidad con el nombre "Asociado"', () => {
      const table = storage.tables.find(
        (t) => t.target === Asociado || t.name === 'Asociado',
      );
      expect(table).toBeDefined();
      expect(table?.name).toBe('Asociado');
    });

    it('debe definir la llave primaria autoincremental "id"', () => {
      const primaryCol = storage.columns.find(
        (c) => c.target === Asociado && c.propertyName === 'id',
      );
      expect(primaryCol).toBeDefined();

      const generation = storage.generations.find(
        (g) => g.target === Asociado && g.propertyName === 'id',
      );
      expect(generation).toBeDefined();
      expect(generation?.strategy).toBe('increment');
    });

    it('debe definir todos los campos requeridos en el modelo', () => {
      const columnNames = storage.columns
        .filter((c) => c.target === Asociado)
        .map((c) => c.propertyName);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('nombre');
      expect(columnNames).toContain('apellidos');
      expect(columnNames).toContain('cedula');
      expect(columnNames).toContain('correoElectronico');
      expect(columnNames).toContain('activo');
      expect(columnNames).toContain('fechaRegistro');
      expect(columnNames).toContain('fechaInactivacion');
      expect(columnNames).toContain('createdAt');
      expect(columnNames).toContain('updatedAt');
    });

    it('debe configurar restricción de cédula única y longitud adecuada', () => {
      const cedulaCol = storage.columns.find(
        (c) => c.target === Asociado && c.propertyName === 'cedula',
      );
      expect(cedulaCol).toBeDefined();
      expect(cedulaCol?.options.unique).toBe(true);
      expect(cedulaCol?.options.length).toBe(30);
    });

    it('debe configurar longitudes adecuadas para nombre, apellidos y correoElectronico', () => {
      const nombreCol = storage.columns.find(
        (c) => c.target === Asociado && c.propertyName === 'nombre',
      );
      const apellidosCol = storage.columns.find(
        (c) => c.target === Asociado && c.propertyName === 'apellidos',
      );
      const correoCol = storage.columns.find(
        (c) => c.target === Asociado && c.propertyName === 'correoElectronico',
      );

      expect(nombreCol?.options.length).toBe(100);
      expect(apellidosCol?.options.length).toBe(100);
      expect(correoCol?.options.length).toBe(150);
    });

    it('debe configurar fechaInactivacion como nullable', () => {
      const fechaInactivacionCol = storage.columns.find(
        (c) => c.target === Asociado && c.propertyName === 'fechaInactivacion',
      );
      expect(fechaInactivacionCol).toBeDefined();
      expect(fechaInactivacionCol?.options.nullable).toBe(true);
    });

    it('debe configurar activo con valor default true', () => {
      const activoCol = storage.columns.find(
        (c) => c.target === Asociado && c.propertyName === 'activo',
      );
      expect(activoCol).toBeDefined();
      expect(activoCol?.options.default).toBe(true);
    });

    it('debe registrar createdAt y updatedAt con decoradores CreateDateColumn y UpdateDateColumn', () => {
      const createdAtCol = storage.columns.find(
        (c) => c.target === Asociado && c.propertyName === 'createdAt',
      );
      const updatedAtCol = storage.columns.find(
        (c) => c.target === Asociado && c.propertyName === 'updatedAt',
      );

      expect(createdAtCol?.mode).toBe('createDate');
      expect(updatedAtCol?.mode).toBe('updateDate');
    });
  });
});
