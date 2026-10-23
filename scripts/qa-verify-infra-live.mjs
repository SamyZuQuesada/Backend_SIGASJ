import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from '../dist/database/data-source.options.js';

loadEnv();

const ds = new DataSource(buildMigrationDataSourceOptions());
await ds.initialize();

const sols = await ds.query(`
  SELECT TOP 15 id, codigoSeguimiento, estado, tipoSolicitudId
  FROM Solicitud
  ORDER BY id DESC
`);
console.log('LATEST_SOLICITUDES', JSON.stringify(sols, null, 2));

const dets = await ds.query(`
  SELECT TOP 15 id, solicitudId, nis, tipoPersona, proposito, nombreFisica, razonSocial, planoAgrimensura, firma
  FROM SolicitudInfraestructuraLinderos
  ORDER BY id DESC
`);
console.log('LATEST_DETALLES', JSON.stringify(dets, null, 2));

const joined = await ds.query(`
  SELECT s.id, s.codigoSeguimiento, s.estado, d.nis, d.tipoPersona, d.proposito,
         d.nombreFisica, d.razonSocial, d.planoAgrimensura, d.solicitudId
  FROM Solicitud s
  INNER JOIN SolicitudInfraestructuraLinderos d ON d.solicitudId = s.id
  WHERE s.codigoSeguimiento LIKE 'SOL-2026-%'
  ORDER BY s.id DESC
`);
console.log('JOINED_2026', JSON.stringify(joined, null, 2));

await ds.destroy();
