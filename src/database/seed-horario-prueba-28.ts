/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { partesLaboralesEnAsada } from '../common/time/reloj-asada';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

async function main(): Promise<void> {
  const idFontanero = Number(process.argv[2] || '3');
  const partes = partesLaboralesEnAsada(new Date());
  const ds = new DataSource(buildMigrationDataSourceOptions());
  await ds.initialize();
  try {
    const existing = (await ds.query(
      `SELECT id FROM HorarioLaboralFontanero WHERE idFontanero = @0 AND diaSemana = @1`,
      [idFontanero, partes.diaSemana],
    )) as { id: number }[];
    if (existing.length > 0) {
      await ds.query(
        `UPDATE HorarioLaboralFontanero
         SET horaInicio = '00:00:00', horaFin = '23:59:59', activo = 1
         WHERE idFontanero = @0 AND diaSemana = @1`,
        [idFontanero, partes.diaSemana],
      );
    } else {
      await ds.query(
        `INSERT INTO HorarioLaboralFontanero (idFontanero, diaSemana, horaInicio, horaFin, activo)
         VALUES (@0, @1, '00:00:00', '23:59:59', 1)`,
        [idFontanero, partes.diaSemana],
      );
    }
    const rows = (await ds.query(
      `SELECT id, idFontanero, diaSemana, CONVERT(varchar(8), horaInicio, 108) AS horaInicio,
              CONVERT(varchar(8), horaFin, 108) AS horaFin, activo
       FROM HorarioLaboralFontanero
       WHERE idFontanero = @0`,
      [idFontanero],
    )) as Array<{
      id: number;
      idFontanero: number;
      diaSemana: number;
      horaInicio: string;
      horaFin: string;
      activo: boolean;
    }>;
    console.log(
      JSON.stringify(
        { diaSemana: partes.diaSemana, idFontanero, rows },
        null,
        2,
      ),
    );
  } finally {
    await ds.destroy();
  }
}

void main();
