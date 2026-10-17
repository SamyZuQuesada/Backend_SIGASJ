import { getMetadataArgsStorage } from 'typeorm';
import { Colaborador } from './colaborador.entity';
import { Incapacidad } from './incapacidad.entity';

describe('Incapacidad Entity (SIGASJ)', () => {
  describe('Instanciación y asignación de campos', () => {
    it('debe permitir instanciar y asignar todos los atributos', () => {
      const incapacidad = new Incapacidad();
      const createdAt = new Date('2026-10-12T08:00:00Z');
      const updatedAt = new Date('2026-10-12T09:00:00Z');

      incapacidad.id = 1;
      incapacidad.colaboradorId = 3;
      incapacidad.fechaInicio = '2026-10-12';
      incapacidad.fechaFin = '2026-10-20';
      incapacidad.observaciones = 'Documento entregado a administración';
      incapacidad.createdAt = createdAt;
      incapacidad.updatedAt = updatedAt;

      expect(incapacidad.id).toBe(1);
      expect(incapacidad.colaboradorId).toBe(3);
      expect(incapacidad.fechaInicio).toBe('2026-10-12');
      expect(incapacidad.fechaFin).toBe('2026-10-20');
      expect(incapacidad.observaciones).toBe(
        'Documento entregado a administración',
      );
      expect(incapacidad.createdAt).toEqual(createdAt);
      expect(incapacidad.updatedAt).toEqual(updatedAt);
    });

    it('debe permitir observaciones nulas', () => {
      const incapacidad = new Incapacidad();
      incapacidad.observaciones = null;
      expect(incapacidad.observaciones).toBeNull();
    });

    it('no define campos médicos', () => {
      const incapacidad = new Incapacidad();
      expect(incapacidad).not.toHaveProperty('diagnostico');
      expect(incapacidad).not.toHaveProperty('enfermedad');
      expect(incapacidad).not.toHaveProperty('tratamiento');
      expect(incapacidad).not.toHaveProperty('medicamentos');
      expect(incapacidad).not.toHaveProperty('sintomas');
      expect(incapacidad).not.toHaveProperty('expedienteMedico');
    });
  });

  describe('Hooks de ciclo de vida', () => {
    it('debe normalizar fechas a YYYY-MM-DD', () => {
      const incapacidad = new Incapacidad();
      incapacidad.fechaInicio = '2026-10-12T00:00:00.000Z';
      incapacidad.fechaFin = '2026-10-20T00:00:00.000Z';
      incapacidad.normalizar();
      expect(incapacidad.fechaInicio).toBe('2026-10-12');
      expect(incapacidad.fechaFin).toBe('2026-10-20');
    });

    it('debe recortar observaciones y convertir vacías a null', () => {
      const incapacidad = new Incapacidad();
      incapacidad.observaciones = '  Incapacidad registrada.  ';
      incapacidad.normalizar();
      expect(incapacidad.observaciones).toBe('Incapacidad registrada.');

      incapacidad.observaciones = '';
      incapacidad.normalizar();
      expect(incapacidad.observaciones).toBeNull();
    });

    it('debe hidratar fechas al cargar', () => {
      const incapacidad = new Incapacidad();
      incapacidad.fechaInicio = new Date(2026, 9, 12) as unknown as string;
      incapacidad.fechaFin = new Date(2026, 9, 20) as unknown as string;
      incapacidad.hidratarFechas();
      expect(incapacidad.fechaInicio).toBe('2026-10-12');
      expect(incapacidad.fechaFin).toBe('2026-10-20');
    });
  });

  describe('Metadatos de TypeORM', () => {
    const storage = getMetadataArgsStorage();
    const columna = (propertyName: string) =>
      storage.columns.find(
        (c) => c.target === Incapacidad && c.propertyName === propertyName,
      );

    it('debe estar registrada como entidad "Incapacidad"', () => {
      const table = storage.tables.find((t) => t.target === Incapacidad);
      expect(table?.name).toBe('Incapacidad');
    });

    it('debe definir la llave primaria autoincremental "id"', () => {
      const generation = storage.generations.find(
        (g) => g.target === Incapacidad && g.propertyName === 'id',
      );
      expect(columna('id')?.options.primary).toBe(true);
      expect(generation?.strategy).toBe('increment');
    });

    it('debe definir todos los campos del modelo administrativo', () => {
      const columnNames = storage.columns
        .filter((c) => c.target === Incapacidad)
        .map((c) => c.propertyName);

      expect(columnNames).toEqual(
        expect.arrayContaining([
          'id',
          'colaboradorId',
          'fechaInicio',
          'fechaFin',
          'observaciones',
          'createdAt',
          'updatedAt',
        ]),
      );
      expect(columnNames).not.toEqual(
        expect.arrayContaining([
          'diagnostico',
          'enfermedad',
          'tratamiento',
          'medicamentos',
          'sintomas',
          'expedienteMedico',
          'motivoMedico',
        ]),
      );
    });

    it('debe relacionarse con Colaborador', () => {
      const relacion = storage.relations.find(
        (r) => r.target === Incapacidad && r.propertyName === 'colaborador',
      );
      expect(relacion).toBeDefined();
      expect(relacion?.relationType).toBe('many-to-one');
      expect((relacion?.type as () => unknown)()).toBe(Colaborador);
      expect(relacion?.options.onDelete).toBe('CASCADE');

      const joinColumn = storage.joinColumns.find(
        (j) => j.target === Incapacidad && j.propertyName === 'colaborador',
      );
      expect(joinColumn?.name).toBe('colaboradorId');
      expect(joinColumn?.referencedColumnName).toBe('id');
      expect(joinColumn?.foreignKeyConstraintName).toBe(
        'FK_Incapacidad_Colaborador',
      );
    });

    it('Colaborador expone la relación inversa incapacidades', () => {
      const inversa = storage.relations.find(
        (r) => r.target === Colaborador && r.propertyName === 'incapacidades',
      );
      expect(inversa?.relationType).toBe('one-to-many');
      expect((inversa?.type as () => unknown)()).toBe(Incapacidad);
    });

    it('debe indexar por colaborador y por fechas del periodo', () => {
      const indices = storage.indices
        .filter((i) => i.target === Incapacidad)
        .map((i) => i.name);
      expect(indices).toEqual(
        expect.arrayContaining([
          'IX_Incapacidad_colaboradorId',
          'IX_Incapacidad_fechas',
        ]),
      );
    });

    it('debe registrar createdAt y updatedAt automáticos', () => {
      expect(columna('createdAt')?.mode).toBe('createDate');
      expect(columna('updatedAt')?.mode).toBe('updateDate');
    });

    it('debe marcar observaciones como opcionales y fechas como date', () => {
      expect(columna('observaciones')?.options.nullable).toBe(true);
      expect(columna('observaciones')?.options.length).toBe(500);
      expect(columna('fechaInicio')?.options.type).toBe('varchar');
      expect(columna('fechaFin')?.options.type).toBe('varchar');
      expect(columna('fechaInicio')?.options.length).toBe(10);
      expect(columna('fechaFin')?.options.length).toBe(10);
    });
  });
});
