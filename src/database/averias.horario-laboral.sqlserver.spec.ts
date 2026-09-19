import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { EstadoAveria } from '../common/enums/estado-averia.enum';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

type InsertIdRow = { id: number };
type HorarioRow = {
  id: number;
  idFontanero: number;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  activo: boolean | number;
};
type EstadoRow = { estado: string };

describe('SQL Server — horario laboral 3.6', () => {
  let dataSource: DataSource | null = null;
  let isConnected = false;

  beforeAll(async () => {
    try {
      const options = buildMigrationDataSourceOptions();
      if (options.type === 'mssql') {
        dataSource = new DataSource(options);
        await dataSource.initialize();
        isConnected = true;
      }
    } catch (error) {
      isConnected = false;
      console.warn(
        '[AVISO QA 3.6] SQL Server no está disponible:',
        error instanceof Error ? error.message : error,
      );
    }
  }, 15_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  const requireSqlServer = (): DataSource => {
    if (!isConnected || !dataSource) {
      pending('SQL Server no está disponible: persistencia 3.6 no verificada');
      throw new Error('SQL Server no disponible');
    }
    return dataSource;
  };

  it('confirma HorarioLaboralFontanero y que Averia no persiste Fuera de horario', async () => {
    const db = requireSqlServer();
    const tablas = (await db.query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME IN ('HorarioLaboralFontanero', 'Averia')
    `)) as { TABLE_NAME: string }[];
    expect(tablas.map((row) => row.TABLE_NAME)).toEqual(
      expect.arrayContaining(['HorarioLaboralFontanero', 'Averia']),
    );

    const estados = (await db.query(`
      SELECT DISTINCT estado FROM Averia
    `)) as EstadoRow[];
    expect(estados.map((row) => row.estado)).not.toContain('FUERA_DE_HORARIO');
    expect(Object.values(EstadoAveria)).not.toContain('FUERA_DE_HORARIO');
  });

  it('almacena y consulta un horario de prueba para un Fontanero', async () => {
    const db = requireSqlServer();
    const queryRunner = db.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const fontaneros = (await queryRunner.query(`
        SELECT TOP 1 u.idUsuario, u.nombre
        FROM Usuario u
        INNER JOIN Rol r ON r.idRol = u.idRol
        WHERE r.nombre = 'FONTANERO'
        ORDER BY u.idUsuario
      `)) as { idUsuario: number; nombre: string }[];
      const fontanero = fontaneros[0];
      if (!fontanero) {
        pending('No hay un Fontanero persistido para la prueba de horario');
        return;
      }

      await queryRunner.query(
        `
        DELETE FROM HorarioLaboralFontanero
        WHERE idFontanero = @0 AND diaSemana = 1
      `,
        [fontanero.idUsuario],
      );

      const insertado = (await queryRunner.query(
        `
        INSERT INTO HorarioLaboralFontanero (idFontanero, diaSemana, horaInicio, horaFin, activo)
        OUTPUT INSERTED.id
        VALUES (@0, 1, '07:00:00', '16:00:00', 1)
      `,
        [fontanero.idUsuario],
      )) as InsertIdRow[];
      expect(insertado[0]?.id).toBeDefined();

      const stored = (await queryRunner.query(
        `
        SELECT id, idFontanero, diaSemana, CONVERT(varchar(8), horaInicio, 108) AS horaInicio,
               CONVERT(varchar(8), horaFin, 108) AS horaFin, activo
        FROM HorarioLaboralFontanero
        WHERE id = @0
      `,
        [insertado[0].id],
      )) as HorarioRow[];

      expect(stored).toHaveLength(1);
      expect(Number(stored[0]?.idFontanero)).toBe(Number(fontanero.idUsuario));
      expect(Number(stored[0]?.diaSemana)).toBe(1);
      expect(String(stored[0]?.horaInicio).startsWith('07:00')).toBe(true);
      expect(String(stored[0]?.horaFin).startsWith('16:00')).toBe(true);
    } finally {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await queryRunner.release();
    }
  });
});
