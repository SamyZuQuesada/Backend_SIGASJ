import { getMetadataArgsStorage } from 'typeorm';
import { Colaborador } from './colaborador.entity';
import { PermisoColaborador } from './permiso-colaborador.entity';

describe('PermisoColaborador Entity (SIGASJ)', () => {
  describe('Instanciación y asignación de campos', () => {
    it('debe permitir instanciar y asignar todos los atributos', () => {
      const permiso = new PermisoColaborador();
      const createdAt = new Date('2026-10-08T08:00:00Z');
      const updatedAt = new Date('2026-10-08T09:00:00Z');

      permiso.id = 1;
      permiso.colaboradorId = 3;
      permiso.fechaInicio = '2026-10-12';
      permiso.fechaFin = '2026-10-14';
      permiso.motivo = 'Cita médica';
      permiso.observaciones = 'Requiere cobertura';
      permiso.createdAt = createdAt;
      permiso.updatedAt = updatedAt;

      expect(permiso.id).toBe(1);
      expect(permiso.colaboradorId).toBe(3);
      expect(permiso.fechaInicio).toBe('2026-10-12');
      expect(permiso.fechaFin).toBe('2026-10-14');
      expect(permiso.motivo).toBe('Cita médica');
      expect(permiso.observaciones).toBe('Requiere cobertura');
      expect(permiso.createdAt).toEqual(createdAt);
      expect(permiso.updatedAt).toEqual(updatedAt);
    });

    it('debe permitir observaciones nulas', () => {
      const permiso = new PermisoColaborador();
      permiso.observaciones = null;
      expect(permiso.observaciones).toBeNull();
    });
  });

  describe('Hooks de ciclo de vida', () => {
    it('debe recortar motivo y observaciones', () => {
      const permiso = new PermisoColaborador();
      permiso.motivo = '  Cita médica  ';
      permiso.observaciones = '  Cobertura  ';
      permiso.normalizar();
      expect(permiso.motivo).toBe('Cita médica');
      expect(permiso.observaciones).toBe('Cobertura');
    });

    it('debe convertir observaciones vacías a null', () => {
      const permiso = new PermisoColaborador();
      permiso.motivo = 'Permiso';
      permiso.observaciones = '';
      permiso.normalizar();
      expect(permiso.observaciones).toBeNull();
    });
  });

  describe('Metadatos de TypeORM', () => {
    const storage = getMetadataArgsStorage();
    const columna = (propertyName: string) =>
      storage.columns.find(
        (c) => c.target === PermisoColaborador && c.propertyName === propertyName,
      );

    it('debe estar registrada como entidad "PermisoColaborador"', () => {
      const table = storage.tables.find((t) => t.target === PermisoColaborador);
      expect(table?.name).toBe('PermisoColaborador');
    });

    it('debe definir la llave primaria autoincremental "id"', () => {
      const generation = storage.generations.find(
        (g) => g.target === PermisoColaborador && g.propertyName === 'id',
      );
      expect(columna('id')?.options.primary).toBe(true);
      expect(generation?.strategy).toBe('increment');
    });

    it('debe definir todos los campos del modelo', () => {
      const columnNames = storage.columns
        .filter((c) => c.target === PermisoColaborador)
        .map((c) => c.propertyName);

      expect(columnNames).toEqual(
        expect.arrayContaining([
          'id',
          'colaboradorId',
          'fechaInicio',
          'fechaFin',
          'motivo',
          'observaciones',
          'createdAt',
          'updatedAt',
        ]),
      );
    });

    it('debe relacionarse con Colaborador', () => {
      const relacion = storage.relations.find(
        (r) =>
          r.target === PermisoColaborador && r.propertyName === 'colaborador',
      );
      expect(relacion).toBeDefined();
      expect(relacion?.relationType).toBe('many-to-one');
      expect((relacion?.type as () => unknown)()).toBe(Colaborador);
      expect(relacion?.options.onDelete).toBe('CASCADE');

      const joinColumn = storage.joinColumns.find(
        (j) =>
          j.target === PermisoColaborador && j.propertyName === 'colaborador',
      );
      expect(joinColumn?.name).toBe('colaboradorId');
      expect(joinColumn?.referencedColumnName).toBe('id');
      expect(joinColumn?.foreignKeyConstraintName).toBe(
        'FK_PermisoColaborador_Colaborador',
      );
    });

    it('debe registrar createdAt y updatedAt automáticos', () => {
      expect(columna('createdAt')?.mode).toBe('createDate');
      expect(columna('updatedAt')?.mode).toBe('updateDate');
    });

    it('debe marcar observaciones como opcionales', () => {
      expect(columna('observaciones')?.options.nullable).toBe(true);
    });
  });
});
