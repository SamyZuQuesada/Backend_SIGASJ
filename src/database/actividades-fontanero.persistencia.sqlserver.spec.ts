import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { EstadoActividadFontanero } from '../common/enums/estado-actividad-fontanero.enum';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

type TipoRow = { id: number; codigo: string };
type ActividadRow = {
  id: number;
  titulo: string;
  estado: string;
  observacionCorreccion: string | null;
  fontaneroId: string;
};

const describeSqlServer =
  process.env.RUN_SQLSERVER_INTEGRATION === 'true' ? describe : describe.skip;

/**
 * Backlog 7.10 — persistencia real registro/corrección en SQL Server.
 * Inserta, actualiza y limpia filas de prueba (no depende de HTTP Nest).
 */
describeSqlServer('SQL Server — registro y corrección de actividades', () => {
  jest.setTimeout(60_000);
  let dataSource: DataSource;
  let tipoId: number | null = null;
  const createdIds: number[] = [];
  const marker = `QA710-${Date.now()}`;

  beforeAll(async () => {
    const options = buildMigrationDataSourceOptions();
    if (options.type !== 'mssql') {
      throw new Error('Esta suite requiere DB_TYPE=mssql.');
    }
    dataSource = new DataSource(options);
    await dataSource.initialize();

    const tipos = await dataSource.query<TipoRow[]>(`
      SELECT TOP 1 id, codigo
      FROM TipoActividadFontanero
      WHERE activo = 1
      ORDER BY orden, id
    `);
    tipoId = tipos[0]?.id ?? null;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      for (const id of createdIds) {
        await dataSource.query(
          `DELETE FROM DocumentoActividadFontanero WHERE idActividad = @0`,
          [id],
        );
        await dataSource.query(`DELETE FROM ActividadFontanero WHERE id = @0`, [
          id,
        ]);
      }
      await dataSource.destroy();
    }
  });

  it('persiste un registro de actividad válido', async () => {
    expect(tipoId).not.toBeNull();

    const insert = await dataSource.query<{ id: number }[]>(
      `
      INSERT INTO ActividadFontanero (
        fontaneroId, idTipoActividad, fechaActividad, titulo, estado,
        observacionCorreccion, createdAt, updatedAt
      )
      OUTPUT INSERTED.id
      VALUES (
        @0, @1, @2, @3, @4, NULL, SYSUTCDATETIME(), SYSUTCDATETIME()
      )
    `,
      [
        'fontanero-qa-710',
        tipoId,
        '2026-09-08',
        `Registro ${marker}`,
        EstadoActividadFontanero.REPORTADA,
      ],
    );

    const id = Number(insert[0]?.id);
    expect(id).toBeGreaterThan(0);
    createdIds.push(id);

    const rows = await dataSource.query<ActividadRow[]>(
      `SELECT id, titulo, estado, observacionCorreccion, fontaneroId
       FROM ActividadFontanero WHERE id = @0`,
      [id],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        titulo: `Registro ${marker}`,
        estado: EstadoActividadFontanero.REPORTADA,
        fontaneroId: 'fontanero-qa-710',
        observacionCorreccion: null,
      }),
    );
  });

  it('persiste solicitud de corrección y reenvío corregido', async () => {
    expect(tipoId).not.toBeNull();

    const insert = await dataSource.query<{ id: number }[]>(
      `
      INSERT INTO ActividadFontanero (
        fontaneroId, idTipoActividad, fechaActividad, titulo, estado,
        observacionCorreccion, createdAt, updatedAt
      )
      OUTPUT INSERTED.id
      VALUES (
        @0, @1, @2, @3, @4, NULL, SYSUTCDATETIME(), SYSUTCDATETIME()
      )
    `,
      [
        'fontanero-qa-710',
        tipoId,
        '2026-09-08',
        `Corregir ${marker}`,
        EstadoActividadFontanero.REPORTADA,
      ],
    );
    const id = Number(insert[0]?.id);
    createdIds.push(id);

    await dataSource.query(
      `
      UPDATE ActividadFontanero
      SET estado = @0,
          observacionCorreccion = @1,
          updatedAt = SYSUTCDATETIME()
      WHERE id = @2
    `,
      [
        EstadoActividadFontanero.REQUIERE_CORRECCION,
        'Indique la presión medida.',
        id,
      ],
    );

    let rows = await dataSource.query<ActividadRow[]>(
      `SELECT id, titulo, estado, observacionCorreccion, fontaneroId
       FROM ActividadFontanero WHERE id = @0`,
      [id],
    );
    expect(rows[0]?.estado).toBe(EstadoActividadFontanero.REQUIERE_CORRECCION);
    expect(rows[0]?.observacionCorreccion).toBe('Indique la presión medida.');

    await dataSource.query(
      `
      UPDATE ActividadFontanero
      SET estado = @0,
          titulo = @1,
          observacionCorreccion = NULL,
          updatedAt = SYSUTCDATETIME()
      WHERE id = @2
    `,
      [EstadoActividadFontanero.CORREGIDA, `Corregida ${marker}`, id],
    );

    rows = await dataSource.query<ActividadRow[]>(
      `SELECT id, titulo, estado, observacionCorreccion, fontaneroId
       FROM ActividadFontanero WHERE id = @0`,
      [id],
    );
    expect(rows[0]).toEqual(
      expect.objectContaining({
        titulo: `Corregida ${marker}`,
        estado: EstadoActividadFontanero.CORREGIDA,
        observacionCorreccion: null,
      }),
    );
  });
});
