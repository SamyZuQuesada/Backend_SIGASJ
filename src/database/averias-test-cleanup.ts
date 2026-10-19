import { DataSource } from 'typeorm';

const TABLAS_HIJAS_AVERIA = [
  'NotificacionAveria',
  'IntentoSmsAveria',
  'ObservacionAveria',
  'HistorialAveria',
] as const;

/**
 * Borra averías de prueba junto con las filas que las referencian
 * (notificaciones, SMS, observaciones e historial), para respetar las FK.
 */
export async function borrarAveriasDePrueba(
  ds: DataSource,
  whereAveria: string,
  params: unknown[],
): Promise<void> {
  for (const tabla of TABLAS_HIJAS_AVERIA) {
    await ds.query(
      `DELETE FROM ${tabla} WHERE idAveria IN (SELECT id FROM Averia WHERE ${whereAveria})`,
      params,
    );
  }
  await ds.query(`DELETE FROM Averia WHERE ${whereAveria}`, params);
}
