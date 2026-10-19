import { BadRequestException } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import { TipoMovimientoVacaciones } from '../../../common/enums/tipo-movimiento-vacaciones.enum';
import { Colaborador } from './colaborador.entity';
import { MovimientoVacaciones } from './movimiento-vacaciones.entity';

describe('MovimientoVacaciones Entity (SIGASJ)', () => {
  describe('Instanciación y asignación de campos', () => {
    it('debe permitir instanciar y asignar todos los atributos', () => {
      const movimiento = new MovimientoVacaciones();
      const createdAt = new Date('2026-10-11T08:00:00Z');

      movimiento.id = 1;
      movimiento.colaboradorId = 3;
      movimiento.tipo = TipoMovimientoVacaciones.ACUMULADO;
      movimiento.cantidadDias = 12;
      movimiento.fecha = '2026-10-11';
      movimiento.observaciones = 'Periodo 2025-2026';
      movimiento.createdAt = createdAt;

      expect(movimiento.id).toBe(1);
      expect(movimiento.colaboradorId).toBe(3);
      expect(movimiento.tipo).toBe('ACUMULADO');
      expect(movimiento.cantidadDias).toBe(12);
      expect(movimiento.fecha).toBe('2026-10-11');
      expect(movimiento.observaciones).toBe('Periodo 2025-2026');
      expect(movimiento.createdAt).toEqual(createdAt);
    });

    it('distingue ACUMULADO de DISFRUTADO', () => {
      const acumulado = new MovimientoVacaciones();
      acumulado.tipo = TipoMovimientoVacaciones.ACUMULADO;
      const disfrutado = new MovimientoVacaciones();
      disfrutado.tipo = TipoMovimientoVacaciones.DISFRUTADO;

      expect(acumulado.tipo).not.toBe(disfrutado.tipo);
      expect(Object.values(TipoMovimientoVacaciones)).toEqual([
        'ACUMULADO',
        'DISFRUTADO',
        'AJUSTE',
      ]);
    });
  });

  describe('Hooks de ciclo de vida', () => {
    it('debe recortar observaciones y convertir vacías a null', () => {
      const movimiento = new MovimientoVacaciones();
      movimiento.observaciones = '  Vacaciones  ';
      movimiento.normalizar();
      expect(movimiento.observaciones).toBe('Vacaciones');

      movimiento.observaciones = '';
      movimiento.normalizar();
      expect(movimiento.observaciones).toBeNull();
    });

    it('debe normalizar la fecha a YYYY-MM-DD', () => {
      const movimiento = new MovimientoVacaciones();
      movimiento.fecha = '2026-10-11T00:00:00.000Z';
      movimiento.normalizar();
      expect(movimiento.fecha).toBe('2026-10-11');

      movimiento.fecha = new Date(2026, 9, 11) as unknown as string;
      movimiento.hidratarFecha();
      expect(movimiento.fecha).toBe('2026-10-11');
    });

    it('rechaza un tipo fuera del catálogo', () => {
      const movimiento = new MovimientoVacaciones();
      movimiento.tipo = 'PENDIENTE' as TipoMovimientoVacaciones;
      expect(() => movimiento.validar()).toThrow(BadRequestException);
    });

    it.each([0, -1, 1.5, '3' as unknown as number])(
      'rechaza cantidadDias inválida (%p)',
      (valor) => {
        const movimiento = new MovimientoVacaciones();
        movimiento.tipo = TipoMovimientoVacaciones.DISFRUTADO;
        movimiento.cantidadDias = valor;
        expect(() => movimiento.validar()).toThrow(BadRequestException);
      },
    );

    it('acepta un movimiento válido', () => {
      const movimiento = new MovimientoVacaciones();
      movimiento.tipo = TipoMovimientoVacaciones.DISFRUTADO;
      movimiento.cantidadDias = 3;
      expect(() => movimiento.validar()).not.toThrow();
    });
  });

  describe('Metadatos de TypeORM', () => {
    const storage = getMetadataArgsStorage();
    const columna = (propertyName: string) =>
      storage.columns.find(
        (c) =>
          c.target === MovimientoVacaciones && c.propertyName === propertyName,
      );

    it('debe estar registrada como entidad "MovimientoVacaciones"', () => {
      const table = storage.tables.find(
        (t) => t.target === MovimientoVacaciones,
      );
      expect(table?.name).toBe('MovimientoVacaciones');
    });

    it('debe definir la llave primaria autoincremental "id"', () => {
      const generation = storage.generations.find(
        (g) => g.target === MovimientoVacaciones && g.propertyName === 'id',
      );
      expect(columna('id')?.options.primary).toBe(true);
      expect(generation?.strategy).toBe('increment');
    });

    it('debe definir todos los campos del modelo', () => {
      const columnNames = storage.columns
        .filter((c) => c.target === MovimientoVacaciones)
        .map((c) => c.propertyName);

      expect(columnNames).toEqual(
        expect.arrayContaining([
          'id',
          'colaboradorId',
          'tipo',
          'cantidadDias',
          'fecha',
          'observaciones',
          'createdAt',
        ]),
      );
      expect(columnNames).not.toContain('updatedAt');
    });

    it('debe relacionarse con Colaborador', () => {
      const relacion = storage.relations.find(
        (r) =>
          r.target === MovimientoVacaciones && r.propertyName === 'colaborador',
      );
      expect(relacion).toBeDefined();
      expect(relacion?.relationType).toBe('many-to-one');
      expect((relacion?.type as () => unknown)()).toBe(Colaborador);
      expect(relacion?.options.onDelete).toBe('CASCADE');

      const joinColumn = storage.joinColumns.find(
        (j) =>
          j.target === MovimientoVacaciones && j.propertyName === 'colaborador',
      );
      expect(joinColumn?.name).toBe('colaboradorId');
      expect(joinColumn?.referencedColumnName).toBe('id');
      expect(joinColumn?.foreignKeyConstraintName).toBe(
        'FK_MovimientoVacaciones_Colaborador',
      );
    });

    it('Colaborador expone la relación inversa movimientosVacaciones', () => {
      const inversa = storage.relations.find(
        (r) =>
          r.target === Colaborador &&
          r.propertyName === 'movimientosVacaciones',
      );
      expect(inversa?.relationType).toBe('one-to-many');
      expect((inversa?.type as () => unknown)()).toBe(MovimientoVacaciones);
    });

    it('debe indexar por colaborador y por colaborador+fecha', () => {
      const indices = storage.indices
        .filter((i) => i.target === MovimientoVacaciones)
        .map((i) => i.name);
      expect(indices).toEqual(
        expect.arrayContaining([
          'IX_MovimientoVacaciones_colaboradorId',
          'IX_MovimientoVacaciones_colaborador_fecha',
        ]),
      );
    });

    it('debe registrar createdAt automático y observaciones opcionales', () => {
      expect(columna('createdAt')?.mode).toBe('createDate');
      expect(columna('observaciones')?.options.nullable).toBe(true);
      expect(columna('fecha')?.options.type).toBe('varchar');
      expect(columna('fecha')?.options.length).toBe(10);
      expect(columna('cantidadDias')?.options.type).toBe('int');
    });
  });
});
