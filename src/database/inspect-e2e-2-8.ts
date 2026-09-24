import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

async function main(): Promise<void> {
  const codigo = process.argv[2];
  const ds = new DataSource(buildMigrationDataSourceOptions());
  await ds.initialize();
  try {
    const averias = codigo
      ? await ds.query(
          `SELECT TOP 5 id, codigoSeguimiento, estado, idFontaneroAsignado, telefonoReportante
           FROM Averia WHERE codigoSeguimiento = @0`,
          [codigo],
        )
      : [];
    const ids = (averias as { id: number }[]).map((row) => row.id);
    const notifs =
      ids.length === 0
        ? []
        : await ds.query(
            `SELECT id, idUsuarioDestinatario, idAveria, tipo, leida, fechaLectura, fechaCreacion
             FROM NotificacionAveria WHERE idAveria IN (${ids.join(',')})
             ORDER BY id`,
          );
    const sms =
      ids.length === 0
        ? []
        : await ds.query(
            `SELECT id, idAveria, tipoEvento, destinatarioClase, estadoEnvio, motivoBloqueo, fechaCreacion
             FROM IntentoSmsAveria WHERE idAveria IN (${ids.join(',')})
             ORDER BY id`,
          );
    const secretaria = await ds.query(
      `SELECT COUNT(*) AS c FROM NotificacionAveria n
       INNER JOIN Usuario u ON u.idUsuario = n.idUsuarioDestinatario
       INNER JOIN Rol r ON r.idRol = u.idRol
       WHERE r.nombre = 'SECRETARIA' AND n.idAveria IN (${ids.length ? ids.join(',') : '0'})`,
    );
    console.log(
      JSON.stringify({ averias, notifs, sms, secretariaInbox: secretaria }, null, 2),
    );
  } finally {
    await ds.destroy();
  }
}

void main();
