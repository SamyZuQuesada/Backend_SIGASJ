import { config as loadEnv } from 'dotenv';
import { DataSource, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { TipoDocumentoSolicitud } from '../common/enums/tipo-documento-solicitud.enum';
import { DocumentoSolicitud } from '../modules/solicitudes/entities/documento-solicitud.entity';
import { Solicitud } from '../modules/solicitudes/entities/solicitud.entity';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateDocumentoSolicitudTable1724686170000 } from './migrations/1724686170000-CreateDocumentoSolicitudTable';
import { AddMetadatosToDocumentoSolicitud1724686210000 } from './migrations/1724686210000-AddMetadatosToDocumentoSolicitud';

loadEnv();

describe('Pruebas de Base de Datos e Integridad: Migración DocumentoSolicitud (Tarea 1)', () => {
  describe('1. Definición y Estructura de las Migraciones TypeORM', () => {
    it('debe existir la migración base CreateDocumentoSolicitudTable1724686170000', () => {
      const migration = new CreateDocumentoSolicitudTable1724686170000();
      expect(migration.name).toBe('CreateDocumentoSolicitudTable1724686170000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('debe existir la migración AddMetadatosToDocumentoSolicitud1724686210000', () => {
      const migration = new AddMetadatosToDocumentoSolicitud1724686210000();
      expect(migration.name).toBe('AddMetadatosToDocumentoSolicitud1724686210000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('debe definir la tabla DocumentoSolicitud con todas las columnas de metadatos requeridos', async () => {
      const migration = new CreateDocumentoSolicitudTable1724686170000();
      let createdTable: Table | undefined;
      let createdFk: TableForeignKey | undefined;
      const createdIndices: TableIndex[] = [];

      const createTableSpy = jest
        .fn()
        .mockImplementation((table: Table): Promise<void> => {
          createdTable = table;
          return Promise.resolve();
        });

      const createFkSpy = jest
        .fn()
        .mockImplementation(
          (tableName: string, fk: TableForeignKey): Promise<void> => {
            createdFk = fk;
            return Promise.resolve();
          },
        );

      const createIndexSpy = jest
        .fn()
        .mockImplementation(
          (tableName: string, index: TableIndex): Promise<void> => {
            createdIndices.push(index);
            return Promise.resolve();
          },
        );

      const mockQueryRunner = {
        connection: {
          options: {
            type: 'mssql',
          },
        },
        hasTable: jest.fn().mockResolvedValue(false),
        createTable: createTableSpy,
        createForeignKey: createFkSpy,
        createIndex: createIndexSpy,
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(mockQueryRunner.hasTable).toHaveBeenCalledWith('DocumentoSolicitud');
      expect(createdTable).toBeDefined();
      expect(createdTable?.name).toBe('DocumentoSolicitud');

      const colNames = createdTable?.columns.map((c) => c.name);
      expect(colNames).toContain('id');
      expect(colNames).toContain('solicitudId');
      expect(colNames).toContain('tipoDocumento');
      expect(colNames).toContain('nombreOriginal');
      expect(colNames).toContain('nombreInterno');
      expect(colNames).toContain('mimeType');
      expect(colNames).toContain('tamano');
      expect(colNames).toContain('ubicacion');
      expect(colNames).toContain('fechaCarga');

      // Verifica FK hacia Solicitud
      expect(createdFk).toBeDefined();
      expect(createdFk?.columnNames).toEqual(['solicitudId']);
      expect(createdFk?.referencedTableName).toBe('Solicitud');
      expect(createdFk?.referencedColumnNames).toEqual(['id']);

      // Verifica índices
      const indexNames = createdIndices.map((i) => i.name);
      expect(indexNames).toContain('IX_DocumentoSolicitud_solicitudId');
      expect(indexNames).toContain('UQ_DocumentoSolicitud_tokenReclamo');
      expect(indexNames).toContain('IX_DocumentoSolicitud_nombreInterno');
    });

    it('la migración AddMetadatosToDocumentoSolicitud agrega las columnas faltantes y backfill', async () => {
      const migration = new AddMetadatosToDocumentoSolicitud1724686210000();
      const addedColumns: string[] = [];
      const queriesExecuted: string[] = [];
      let indexCreated: TableIndex | undefined;

      const mockQueryRunner = {
        connection: {
          options: {
            type: 'mssql',
          },
        },
        hasTable: jest.fn().mockResolvedValue(true),
        hasColumn: jest.fn().mockImplementation((table: string, col: string) => {
          if (['nombreInterno', 'mimeType', 'tamano', 'ubicacion'].includes(col)) {
            return Promise.resolve(false);
          }
          return Promise.resolve(true);
        }),
        addColumn: jest.fn().mockImplementation((table: string, column: any) => {
          addedColumns.push(column.name);
          return Promise.resolve();
        }),
        query: jest.fn().mockImplementation((sql: string) => {
          queriesExecuted.push(sql);
          return Promise.resolve();
        }),
        getTable: jest.fn().mockResolvedValue({
          indices: [],
        }),
        createIndex: jest.fn().mockImplementation((table: string, idx: TableIndex) => {
          indexCreated = idx;
          return Promise.resolve();
        }),
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(addedColumns).toContain('nombreInterno');
      expect(addedColumns).toContain('mimeType');
      expect(addedColumns).toContain('tamano');
      expect(addedColumns).toContain('ubicacion');
      expect(indexCreated?.name).toBe('IX_DocumentoSolicitud_nombreInterno');
      expect(queriesExecuted.length).toBeGreaterThan(0);
    });
  });

  describe('2. Verificación en SQL Server y TypeORM', () => {
    let dataSource: DataSource;

    beforeAll(async () => {
      dataSource = new DataSource(buildMigrationDataSourceOptions());
      await dataSource.initialize();
    });

    afterAll(async () => {
      if (dataSource && dataSource.isInitialized) {
        await dataSource.destroy();
      }
    });

    it('debe existir la tabla DocumentoSolicitud en la base de datos con los metadatos requeridos', async () => {
      const cols: { COLUMN_NAME: string }[] = await dataSource.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'DocumentoSolicitud'
      `);

      const columnNames = cols.map((c) => c.COLUMN_NAME);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('solicitudId');
      expect(columnNames).toContain('tipoDocumento');
      expect(columnNames).toContain('nombreOriginal');
      expect(columnNames).toContain('nombreInterno');
      expect(columnNames).toContain('mimeType');
      expect(columnNames).toContain('tamano');
      expect(columnNames).toContain('ubicacion');
      expect(columnNames).toContain('fechaCarga');
    });

    it('debe permitir insertar y consultar metadatos de un DocumentoSolicitud vinculado a una Solicitud', async () => {
      const docRepo = dataSource.getRepository(DocumentoSolicitud);
      const solicitudRepo = dataSource.getRepository(Solicitud);

      // Buscar una solicitud existente para asociar
      const solicitudExistente = await solicitudRepo.findOne({
        where: {},
        order: { id: 'DESC' },
      });

      const tokenReclamo = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const nombreInterno = `${Date.now()}-doc-test.pdf`;

      const nuevoDoc = docRepo.create({
        solicitudId: solicitudExistente ? solicitudExistente.id : null,
        tipoDocumento: TipoDocumentoSolicitud.IDENTIFICACION,
        nombreOriginal: 'mi_cedula.pdf',
        nombreInterno,
        mimeType: 'application/pdf',
        tamano: 154200,
        ubicacion: `/uploads/solicitudes/pendientes/${nombreInterno}`,
        tokenReclamo,
      });

      const guardado = await docRepo.save(nuevoDoc);

      expect(guardado.id).toBeDefined();
      expect(guardado.nombreOriginal).toBe('mi_cedula.pdf');
      expect(guardado.nombreInterno).toBe(nombreInterno);
      expect(guardado.mimeType).toBe('application/pdf');
      expect(guardado.tamano).toBe(154200);
      expect(guardado.ubicacion).toBe(`/uploads/solicitudes/pendientes/${nombreInterno}`);
      expect(guardado.fechaCarga).toBeInstanceOf(Date);

      // Limpieza del registro de prueba
      await docRepo.delete({ id: guardado.id });
    });
  });
});
