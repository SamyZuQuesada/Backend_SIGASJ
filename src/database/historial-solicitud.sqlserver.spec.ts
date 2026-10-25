import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { EstadoSolicitud } from '../common/enums/estado-solicitud.enum';
import { HistorialSolicitud } from '../modules/solicitudes/entities/historial-solicitud.entity';
import { Solicitud } from '../modules/solicitudes/entities/solicitud.entity';
import { Usuario } from '../modules/usuarios/entities/usuario.entity';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateHistorialSolicitudTable1724686220000 } from './migrations/1724686220000-CreateHistorialSolicitudTable';
import { AddObservacionesHistorialSolicitud1724686350000 } from './migrations/1724686350000-AddObservacionesHistorialSolicitud';

loadEnv();

type ColumnInfo = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  CHARACTER_MAXIMUM_LENGTH: number | null;
  IS_NULLABLE: string;
};

type ForeignKeyInfo = {
  FK_NAME: string;
  COLUMN_NAME: string;
  REF_TABLE: string;
  REF_COLUMN: string;
  ON_DELETE: string;
};

describe('HistorialSolicitud contra SQL Server', () => {
  jest.setTimeout(60_000);
  let dataSource: DataSource | null = null;
  let isConnected = false;
  let hasHistorialTable = false;

  beforeAll(async () => {
    try {
      const options = buildMigrationDataSourceOptions();
      if (options.type !== 'mssql') {
        return;
      }
      dataSource = new DataSource(options);
      await dataSource.initialize();
      isConnected = true;

      const existing = await dataSource.query<{ total: number }[]>(`
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'HistorialSolicitud'
      `);

      if (Number(existing[0]?.total) === 0) {
        const deps = await dataSource.query<{ total: number }[]>(`
          SELECT COUNT(*) AS total
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = 'dbo'
            AND TABLE_NAME IN ('Solicitud', 'Usuario')
        `);
        if (Number(deps[0]?.total) === 2) {
          const qr = dataSource.createQueryRunner();
          await new CreateHistorialSolicitudTable1724686220000().up(qr);
          await new AddObservacionesHistorialSolicitud1724686350000().up(qr);
          await qr.release();
        }
      }

      const tables = await dataSource.query<{ total: number }[]>(`
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'HistorialSolicitud'
      `);
      hasHistorialTable = Number(tables[0]?.total) === 1;
    } catch (error) {
      isConnected = false;
      console.warn(
        '[AVISO QA] SQL Server no disponible para HistorialSolicitud:',
        error instanceof Error ? error.message : error,
      );
    }
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  const skipIfUnavailable = (): boolean => {
    if (!isConnected || !dataSource || !hasHistorialTable) {
      console.warn(
        '[AVISO QA] SQL Server / HistorialSolicitud no disponible: prueba omitida',
      );
      return true;
    }
    return false;
  };

  it('valida columnas, nullables y FKs de HistorialSolicitud', async () => {
    if (skipIfUnavailable() || !dataSource) return;

    const cols = await dataSource.query<ColumnInfo[]>(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'HistorialSolicitud'
    `);
    const colMap = new Map(cols.map((c) => [c.COLUMN_NAME, c]));

    expect(colMap.get('id')?.DATA_TYPE).toBe('int');
    expect(colMap.get('solicitudId')?.IS_NULLABLE).toBe('NO');
    expect(colMap.get('estadoAnterior')?.IS_NULLABLE).toBe('YES');
    expect(colMap.get('estadoAnterior')?.CHARACTER_MAXIMUM_LENGTH).toBe(30);
    expect(colMap.get('estadoNuevo')?.IS_NULLABLE).toBe('NO');
    expect(colMap.get('estadoNuevo')?.CHARACTER_MAXIMUM_LENGTH).toBe(30);
    expect(colMap.get('observacionPublica')?.CHARACTER_MAXIMUM_LENGTH).toBe(
      1000,
    );
    expect(colMap.get('observacionPublica')?.IS_NULLABLE).toBe('YES');
    expect(colMap.get('notaInterna')?.CHARACTER_MAXIMUM_LENGTH).toBe(1000);
    expect(colMap.get('notaInterna')?.IS_NULLABLE).toBe('YES');
    expect(colMap.get('idUsuario')?.IS_NULLABLE).toBe('YES');
    expect(['datetime2', 'datetime']).toContain(colMap.get('fecha')?.DATA_TYPE);
    expect(colMap.get('fecha')?.IS_NULLABLE).toBe('NO');

    const fks = await dataSource.query<ForeignKeyInfo[]>(`
      SELECT
        fk.name AS FK_NAME,
        c.name AS COLUMN_NAME,
        rt.name AS REF_TABLE,
        rc.name AS REF_COLUMN,
        fk.delete_referential_action_desc AS ON_DELETE
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc
        ON fkc.constraint_object_id = fk.object_id
      INNER JOIN sys.columns c
        ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
      INNER JOIN sys.tables rt ON rt.object_id = fkc.referenced_object_id
      INNER JOIN sys.columns rc
        ON rc.object_id = fkc.referenced_object_id
       AND rc.column_id = fkc.referenced_column_id
      WHERE OBJECT_NAME(fk.parent_object_id) = 'HistorialSolicitud'
    `);

    const byName = new Map(fks.map((fk) => [fk.FK_NAME, fk]));
    expect(byName.get('FK_HistorialSolicitud_Solicitud')?.REF_TABLE).toBe(
      'Solicitud',
    );
    expect(byName.get('FK_HistorialSolicitud_Solicitud')?.ON_DELETE).toBe(
      'NO_ACTION',
    );
    expect(byName.get('FK_HistorialSolicitud_Usuario')?.REF_TABLE).toBe(
      'Usuario',
    );
    expect(byName.get('FK_HistorialSolicitud_Usuario')?.ON_DELETE).toBe(
      'SET_NULL',
    );
  });

  it('persiste historial, separa solicitudes, textos y orden cronológico', async () => {
    if (skipIfUnavailable() || !dataSource) return;

    const solicitudRepo = dataSource.getRepository(Solicitud);
    const historialRepo = dataSource.getRepository(HistorialSolicitud);
    const usuarioRepo = dataSource.getRepository(Usuario);

    const tipo = await dataSource.query<{ id: number }[]>(`
      SELECT TOP 1 id FROM TipoSolicitud ORDER BY id
    `);
    if (!tipo[0]?.id) {
      console.warn('[AVISO QA] Sin TipoSolicitud: persistencia omitida');
      return;
    }

    const usuario = await usuarioRepo
      .createQueryBuilder('u')
      .orderBy('u.idUsuario', 'ASC')
      .getOne();

    const stamp = Date.now();
    const solicitudA = await solicitudRepo.save(
      solicitudRepo.create({
        tipoSolicitudId: tipo[0].id,
        codigoSeguimiento: `SOL-HST-A-${stamp}`,
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
      }),
    );
    const solicitudB = await solicitudRepo.save(
      solicitudRepo.create({
        tipoSolicitudId: tipo[0].id,
        codigoSeguimiento: `SOL-HST-B-${stamp}`,
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
      }),
    );

    const creacion = historialRepo.create({
      solicitudId: solicitudA.id,
      estadoAnterior: null,
      estadoNuevo: EstadoSolicitud.PENDIENTE,
      observacionPublica: null,
      notaInterna: null,
      idUsuario: null,
    });
    await historialRepo.save(creacion);

    await new Promise((resolve) => setTimeout(resolve, 15));

    const revision = historialRepo.create({
      solicitudId: solicitudA.id,
      estadoAnterior: EstadoSolicitud.PENDIENTE,
      estadoNuevo: EstadoSolicitud.EN_REVISION,
      observacionPublica: 'Su solicitud requiere una corrección.',
      notaInterna: 'El plano aportado presenta información ilegible.',
      idUsuario: usuario?.idUsuario ?? null,
    });
    await historialRepo.save(revision);

    const soloB = historialRepo.create({
      solicitudId: solicitudB.id,
      estadoAnterior: null,
      estadoNuevo: EstadoSolicitud.PENDIENTE,
      observacionPublica: 'Registro B',
      notaInterna: null,
      idUsuario: null,
    });
    await historialRepo.save(soloB);

    const deA = await historialRepo.find({
      where: { solicitudId: solicitudA.id },
      order: { fecha: 'ASC', id: 'ASC' },
    });
    expect(deA).toHaveLength(2);
    expect(deA[0].estadoAnterior).toBeNull();
    expect(deA[0].estadoNuevo).toBe(EstadoSolicitud.PENDIENTE);
    expect(deA[1].estadoAnterior).toBe(EstadoSolicitud.PENDIENTE);
    expect(deA[1].estadoNuevo).toBe(EstadoSolicitud.EN_REVISION);
    expect(deA[1].observacionPublica).toBe(
      'Su solicitud requiere una corrección.',
    );
    expect(deA[1].notaInterna).toBe(
      'El plano aportado presenta información ilegible.',
    );
    expect(deA[1].observacionPublica).not.toBe(deA[1].notaInterna);
    if (usuario) {
      expect(deA[1].idUsuario).toBe(usuario.idUsuario);
    }
    expect(deA[0].fecha.getTime()).toBeLessThanOrEqual(deA[1].fecha.getTime());

    const deB = await historialRepo.find({
      where: { solicitudId: solicitudB.id },
    });
    expect(deB).toHaveLength(1);
    expect(deB[0].solicitudId).toBe(solicitudB.id);

    await historialRepo.delete({ solicitudId: solicitudA.id });
    await historialRepo.delete({ solicitudId: solicitudB.id });
    await solicitudRepo.delete({ id: solicitudA.id });
    await solicitudRepo.delete({ id: solicitudB.id });
  });

  it('rechaza solicitudId e idUsuario inexistentes por FK', async () => {
    if (skipIfUnavailable() || !dataSource) return;

    await expect(
      dataSource.query(`
        INSERT INTO HistorialSolicitud
          (solicitudId, estadoAnterior, estadoNuevo, observacionPublica, notaInterna, idUsuario, fecha)
        VALUES (2147483647, NULL, 'PENDIENTE', NULL, NULL, NULL, SYSUTCDATETIME())
      `),
    ).rejects.toThrow();

    await expect(
      dataSource.query(`
        INSERT INTO HistorialSolicitud
          (solicitudId, estadoAnterior, estadoNuevo, observacionPublica, notaInterna, idUsuario, fecha)
        SELECT TOP 1 id, NULL, 'PENDIENTE', NULL, NULL, 2147483647, SYSUTCDATETIME()
        FROM Solicitud
      `),
    ).rejects.toThrow();
  });
});
