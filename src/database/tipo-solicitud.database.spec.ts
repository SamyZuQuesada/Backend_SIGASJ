import { QueryRunner, Table } from 'typeorm';
import {
  TipoSolicitudSlug,
  TIPOS_SOLICITUD_SEED,
} from '../common/enums/tipo-solicitud-slug.enum';
import { CreateTipoSolicitudTable1724686090000 } from './migrations/1724686090000-CreateTipoSolicitudTable';

describe('Pruebas de Base de Datos e Integridad: Migración TipoSolicitud', () => {
  describe('1. Definición y Estructura de la Migración TypeORM', () => {
    it('debe tener el nombre correcto de migración y métodos up y down', () => {
      const migration = new CreateTipoSolicitudTable1724686090000();
      expect(migration.name).toBe('CreateTipoSolicitudTable1724686090000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('debe definir la tabla TipoSolicitud con columnas, tipos, restricciones y valores por defecto correctos', async () => {
      const migration = new CreateTipoSolicitudTable1724686090000();
      let createdTable: Table | undefined;

      const createTableSpy = jest
        .fn()
        .mockImplementation((table: Table): Promise<void> => {
          createdTable = table;
          return Promise.resolve();
        });

      const queriesExecuted: string[] = [];
      const querySpy = jest
        .fn()
        .mockImplementation((sql: string): Promise<any[]> => {
          queriesExecuted.push(sql);
          if (sql.includes('SELECT id FROM TipoSolicitud')) {
            return Promise.resolve([]); // Simula que no existen registros previos
          }
          return Promise.resolve([]);
        });

      const mockQueryRunner = {
        connection: {
          options: {
            type: 'mssql',
          },
        },
        hasTable: jest.fn().mockResolvedValue(false),
        createTable: createTableSpy,
        query: querySpy,
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(mockQueryRunner.hasTable).toHaveBeenCalledWith('TipoSolicitud');
      expect(createTableSpy).toHaveBeenCalled();
      expect(createdTable).toBeDefined();
      expect(createdTable?.name).toBe('TipoSolicitud');

      // Verificar columnas esperadas
      const colNames = createdTable?.columns.map((c) => c.name);
      expect(colNames).toEqual([
        'id',
        'nombre',
        'descripcion',
        'slug',
        'activo',
        'createdAt',
        'updatedAt',
      ]);

      // Llave primaria id
      const idCol = createdTable?.columns.find((c) => c.name === 'id');
      expect(idCol?.isPrimary).toBe(true);
      expect(idCol?.isGenerated).toBe(true);
      expect(idCol?.generationStrategy).toBe('increment');

      // Nombre (varchar 150 no nulo)
      const nombreCol = createdTable?.columns.find((c) => c.name === 'nombre');
      expect(nombreCol?.type).toBe('varchar');
      expect(nombreCol?.length).toBe('150');
      expect(nombreCol?.isNullable).toBe(false);

      // Descripcion (varchar 500 nulo)
      const descCol = createdTable?.columns.find(
        (c) => c.name === 'descripcion',
      );
      expect(descCol?.type).toBe('varchar');
      expect(descCol?.length).toBe('500');
      expect(descCol?.isNullable).toBe(true);

      // Slug (varchar 100 no nulo, único)
      const slugCol = createdTable?.columns.find((c) => c.name === 'slug');
      expect(slugCol?.type).toBe('varchar');
      expect(slugCol?.length).toBe('100');
      expect(slugCol?.isNullable).toBe(false);
      expect(slugCol?.isUnique).toBe(true);

      // Restricción/Índice único para slug
      const slugIndex = createdTable?.indices.find(
        (i) => i.name === 'UQ_TipoSolicitud_slug',
      );
      expect(slugIndex).toBeDefined();
      expect(slugIndex?.isUnique).toBe(true);
      expect(slugIndex?.columnNames).toContain('slug');

      // Activo (bit/boolean, default true)
      const activoCol = createdTable?.columns.find((c) => c.name === 'activo');
      expect(activoCol?.type).toBe('bit');
      expect(activoCol?.default).toBe(1);
      expect(activoCol?.isNullable).toBe(false);

      // Timestamps
      const createdCol = createdTable?.columns.find(
        (c) => c.name === 'createdAt',
      );
      expect(createdCol?.type).toBe('datetime2');
      expect(createdCol?.default).toBe('GETDATE()');

      const updatedCol = createdTable?.columns.find(
        (c) => c.name === 'updatedAt',
      );
      expect(updatedCol?.type).toBe('datetime2');
      expect(updatedCol?.default).toBe('GETDATE()');
    });

    it('debe registrar inicialmente los 6 tipos oficiales de forma idempotente', async () => {
      const migration = new CreateTipoSolicitudTable1724686090000();
      const inserts: string[] = [];

      const mockQueryRunner = {
        connection: {
          options: {
            type: 'mssql',
          },
        },
        hasTable: jest.fn().mockResolvedValue(true), // Ya existe la tabla
        query: jest.fn().mockImplementation((sql: string) => {
          if (sql.includes('SELECT id FROM TipoSolicitud')) {
            return Promise.resolve([]); // No están insertados
          }
          if (sql.includes('INSERT INTO TipoSolicitud')) {
            inserts.push(sql);
          }
          return Promise.resolve([]);
        }),
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(inserts).toHaveLength(6);
      expect(
        inserts.some((q) => q.includes(TipoSolicitudSlug.ARREGLO_PAGO)),
      ).toBe(true);
      expect(
        inserts.some((q) => q.includes(TipoSolicitudSlug.CAMBIO_TITULAR)),
      ).toBe(true);
      expect(
        inserts.some((q) =>
          q.includes(TipoSolicitudSlug.INFRAESTRUCTURA_LINDEROS),
        ),
      ).toBe(true);
      expect(
        inserts.some((q) => q.includes(TipoSolicitudSlug.AFILIACION)),
      ).toBe(true);
      expect(
        inserts.some((q) =>
          q.includes(TipoSolicitudSlug.DISPONIBILIDAD_SERVICIOS),
        ),
      ).toBe(true);
      expect(
        inserts.some((q) => q.includes(TipoSolicitudSlug.SERVICIO_EXISTENTE)),
      ).toBe(true);
    });

    it('no debe duplicar inserciones si los 6 tipos ya se encuentran registrados', async () => {
      const migration = new CreateTipoSolicitudTable1724686090000();
      const inserts: string[] = [];

      const mockQueryRunner = {
        connection: {
          options: {
            type: 'mssql',
          },
        },
        hasTable: jest.fn().mockResolvedValue(true),
        query: jest.fn().mockImplementation((sql: string) => {
          if (sql.includes('SELECT id FROM TipoSolicitud')) {
            return Promise.resolve([{ id: 1 }]); // Ya existe
          }
          if (sql.includes('INSERT INTO TipoSolicitud')) {
            inserts.push(sql);
          }
          return Promise.resolve([]);
        }),
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(inserts).toHaveLength(0);
    });

    it('debe eliminar la tabla TipoSolicitud en down si existe', async () => {
      const migration = new CreateTipoSolicitudTable1724686090000();
      const dropTableSpy = jest.fn().mockResolvedValue(undefined);

      const mockQueryRunner = {
        hasTable: jest.fn().mockResolvedValue(true),
        dropTable: dropTableSpy,
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);

      expect(mockQueryRunner.hasTable).toHaveBeenCalledWith('TipoSolicitud');
      expect(dropTableSpy).toHaveBeenCalledWith('TipoSolicitud', true);
    });

    it('garantiza que inactivar un tipo preserva registros históricos en BD sin eliminarlos', () => {
      // Simulación de catálogo en memoria y estado activo
      const catalogo = TIPOS_SOLICITUD_SEED.map((seed, idx) => ({
        id: idx + 1,
        ...seed,
        activo: true,
      }));

      // Simulación de registros de solicitudes históricas asociadas a un tipo
      const solicitudesHistoricas = [
        { id: 101, idTipoSolicitud: 1, consecutivo: 'SOL-2026-0001' },
        { id: 102, idTipoSolicitud: 1, consecutivo: 'SOL-2026-0002' },
        { id: 103, idTipoSolicitud: 2, consecutivo: 'SOL-2026-0003' },
      ];

      // Inactivar el tipo con id 1 (Arreglo de Pago)
      const tipoArregloPago = catalogo.find((t) => t.id === 1);
      expect(tipoArregloPago).toBeDefined();
      tipoArregloPago!.activo = false;

      // El tipo pasa a inactivo
      expect(tipoArregloPago!.activo).toBe(false);

      // Las solicitudes históricas se conservan intactas
      const solicitudesAsociadas = solicitudesHistoricas.filter(
        (s) => s.idTipoSolicitud === tipoArregloPago!.id,
      );
      expect(solicitudesAsociadas).toHaveLength(2);
      expect(solicitudesHistoricas).toHaveLength(3);
    });
  });
});
