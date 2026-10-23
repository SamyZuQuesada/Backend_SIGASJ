/**
 * QA e integración 4.6 — Constancia de Infraestructura Frente a Linderos.
 *
 * Valida punta a punta vía SQL Server + capas DTO/service (sin depender de Nest HTTP live):
 * - Persona física + Reunión de fincas → Solicitud + detalle
 * - Persona jurídica + Reunión de fincas → Solicitud + detalle
 * - Sin planoAgrimensura → rechazo (no persiste)
 * - Mass assignment administrativo → no aceptado por ValidationPipe/DTO
 * - FK detalle → Solicitud
 *
 * Propósito 2 oficial: BLOCKED (INFRA-QA-002 — solo «Reunión de fincas» confirmado; sin PDF).
 * Ubicación: texto libre (INFRA-QA-003 — sin catálogos Provincia/Cantón/Distrito).
 * Adjuntos binarios: entidad DocumentoSolicitud (INFRA-QA-001); este spec SQL inserta detalle
 * directamente (la relación de documentos se cubre en unit/API de solicitudes).
 */
import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { CalidadTitularCambioTitular } from '../common/enums/calidad-titular-cambio-titular.enum';
import { MedioNotificacionCambioTitular } from '../common/enums/medio-notificacion-cambio-titular.enum';
import { PropositoInfraestructuraLinderosConfirmado } from '../common/enums/proposito-infraestructura-linderos.enum';
import { TipoPersonaInfraestructuraLinderos } from '../common/enums/tipo-persona-infraestructura-linderos.enum';
import { CreateSolicitudInfraestructuraLinderosDto } from '../modules/solicitudes/dto/create-solicitud-infraestructura-linderos.dto';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

type InsertedIdRow = { id: number };
type DetalleRow = Record<string, unknown>;

const propositoUnico =
  PropositoInfraestructuraLinderosConfirmado.REUNION_FINCAS;

describe('QA integración SQL Server — Infraestructura Linderos', () => {
  jest.setTimeout(90_000);
  let dataSource: DataSource;
  const createdSolicitudIds: number[] = [];

  beforeAll(async () => {
    const options = buildMigrationDataSourceOptions();
    dataSource = new DataSource(options);
    await dataSource.initialize();
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      try {
        for (const id of createdSolicitudIds) {
          await qr.query(`DELETE FROM Solicitud WHERE id = @0`, [id]);
        }
      } finally {
        await qr.release();
      }
      await dataSource.destroy();
    }
  });

  const insertDetalle = async (
    qr: ReturnType<DataSource['createQueryRunner']>,
    solId: number,
    cols: Record<string, unknown>,
  ) => {
    const keys = Object.keys(cols);
    const placeholders = keys.map((_, i) => `@${i + 1}`).join(', ');
    await qr.query(
      `
      INSERT INTO SolicitudInfraestructuraLinderos (
        solicitudId, ${keys.join(', ')}, createdAt, updatedAt
      ) VALUES (
        @0, ${placeholders}, GETDATE(), GETDATE()
      )
    `,
      [solId, ...keys.map((k) => cols[k])],
    );
  };

  it('CASO 1 — Persona física + Reunión de fincas → Solicitud + detalle campo a campo', async () => {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    try {
      const insertSol = (await qr.query(`
        INSERT INTO Solicitud (tipoSolicitudId, codigoSeguimiento, estado, fechaIngreso, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (3, 'SOL-QA-INFR-PF', 'PENDIENTE', GETDATE(), GETDATE(), GETDATE())
      `)) as InsertedIdRow[];
      const solId = insertSol[0].id;
      createdSolicitudIds.push(solId);

      await insertDetalle(qr, solId, {
        nis: 'NIS-QA-PF-01',
        tipoPersona: TipoPersonaInfraestructuraLinderos.FISICA,
        nombreFisica: 'María Elena',
        apellidosFisica: 'Rodríguez Vargas',
        identificacionFisica: '1-1234-0567',
        telefonoFisica: '8888-1234',
        razonSocial: null,
        cedulaJuridica: null,
        nombreRepresentante: null,
        identificacionRepresentante: null,
        telefonoRepresentante: null,
        calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
        provincia: 'San José',
        canton: 'Pérez Zeledón',
        distrito: 'San Isidro de El General',
        direccionExacta: '100 m norte de la iglesia',
        folioReal: '123456-000',
        planoCatastrado: 'SJ-QA-001',
        planoAgrimensura: 'AG-QA-001',
        proposito: propositoUnico,
        medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
        valorNotificacionPrincipal: 'maria.qa@ejemplo.com',
        medioNotificacionSecundario: null,
        valorNotificacionSecundario: null,
        firma: 'data:image/png;base64,qa-pf',
      });

      const sol = (await qr.query(
        `SELECT id, estado, tipoSolicitudId, codigoSeguimiento FROM Solicitud WHERE id = @0`,
        [solId],
      )) as DetalleRow[];
      expect(sol[0].estado).toBe('PENDIENTE');
      expect(Number(sol[0].tipoSolicitudId)).toBe(3);

      const det = (await qr.query(
        `SELECT * FROM SolicitudInfraestructuraLinderos WHERE solicitudId = @0`,
        [solId],
      )) as DetalleRow[];
      expect(det).toHaveLength(1);
      expect(det[0].nis).toBe('NIS-QA-PF-01');
      expect(det[0].tipoPersona).toBe('Persona física');
      expect(det[0].nombreFisica).toBe('María Elena');
      expect(det[0].razonSocial).toBeNull();
      expect(det[0].proposito).toBe('Reunión de fincas');
      expect(det[0].planoAgrimensura).toBe('AG-QA-001');
      expect(det[0].provincia).toBe('San José');
      expect(det[0].firma).toContain('data:image/png;base64');
      expect(Number(det[0].solicitudId)).toBe(Number(solId));
    } finally {
      await qr.release();
    }
  });

  it('CASO 2 — Persona jurídica + Reunión de fincas → detalle sin campos físicos', async () => {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    try {
      const insertSol = (await qr.query(`
        INSERT INTO Solicitud (tipoSolicitudId, codigoSeguimiento, estado, fechaIngreso, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (3, 'SOL-QA-INFR-PJ', 'PENDIENTE', GETDATE(), GETDATE(), GETDATE())
      `)) as InsertedIdRow[];
      const solId = insertSol[0].id;
      createdSolicitudIds.push(solId);

      await insertDetalle(qr, solId, {
        nis: 'NIS-QA-PJ-01',
        tipoPersona: TipoPersonaInfraestructuraLinderos.JURIDICA,
        nombreFisica: null,
        apellidosFisica: null,
        identificacionFisica: null,
        telefonoFisica: null,
        razonSocial: 'Inversiones QA S.A.',
        cedulaJuridica: '3-101-999888',
        nombreRepresentante: 'Luis Alberto Mora',
        identificacionRepresentante: '1-0987-6543',
        telefonoRepresentante: '8777-4321',
        calidadTitular: CalidadTitularCambioTitular.REPRESENTANTE_LEGAL,
        provincia: 'San José',
        canton: 'Pérez Zeledón',
        distrito: 'Daniel Flores',
        direccionExacta: 'Frente a la escuela',
        folioReal: null,
        planoCatastrado: 'SJ-QA-PJ',
        planoAgrimensura: 'AG-QA-PJ',
        proposito: propositoUnico,
        medioNotificacionPrincipal: MedioNotificacionCambioTitular.TELEFONO,
        valorNotificacionPrincipal: '8777-4321',
        medioNotificacionSecundario: null,
        valorNotificacionSecundario: null,
        firma: null,
      });

      const det = (await qr.query(
        `SELECT * FROM SolicitudInfraestructuraLinderos WHERE solicitudId = @0`,
        [solId],
      )) as DetalleRow[];
      expect(det[0].tipoPersona).toBe('Persona jurídica');
      expect(det[0].razonSocial).toBe('Inversiones QA S.A.');
      expect(det[0].cedulaJuridica).toBe('3-101-999888');
      expect(det[0].nombreFisica).toBeNull();
      expect(det[0].identificacionFisica).toBeNull();
      expect(det[0].proposito).toBe('Reunión de fincas');
      expect(det[0].firma).toBeNull();
    } finally {
      await qr.release();
    }
  });

  it('CASO 3 — DTO rechaza Reunión de fincas sin planoAgrimensura (documento condicional)', async () => {
    const dto = plainToInstance(CreateSolicitudInfraestructuraLinderosDto, {
      nis: 'NIS-FAIL',
      tipoPersona: TipoPersonaInfraestructuraLinderos.FISICA,
      nombreFisica: 'Ana',
      apellidosFisica: 'Pérez',
      identificacionFisica: '1-1111-1111',
      telefonoFisica: '8888-1111',
      calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
      provincia: 'San José',
      canton: 'Pérez Zeledón',
      distrito: 'San Isidro',
      direccionExacta: 'Calle 1',
      planoCatastrado: 'SJ-1',
      proposito: propositoUnico,
      medioNotificacionPrincipal: MedioNotificacionCambioTitular.TELEFONO,
      documentos: [
        { id: 1, tokenReclamo: 't1' },
        { id: 2, tokenReclamo: 't2' },
        { id: 3, tokenReclamo: 't3' },
      ],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'planoAgrimensura')).toBe(true);
  });

  it('CASO 4 — ValidationPipe forbidNonWhitelisted rechaza campos administrativos', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        {
          nis: 'NIS-ADMIN',
          tipoPersona: TipoPersonaInfraestructuraLinderos.FISICA,
          nombreFisica: 'Ana',
          apellidosFisica: 'Pérez',
          identificacionFisica: '1-1111-1111',
          telefonoFisica: '8888-1111',
          calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
          provincia: 'San José',
          canton: 'Pérez Zeledón',
          distrito: 'San Isidro',
          direccionExacta: 'Calle 1',
          planoCatastrado: 'SJ-1',
          planoAgrimensura: 'AG-1',
          proposito: propositoUnico,
          medioNotificacionPrincipal: MedioNotificacionCambioTitular.TELEFONO,
          documentos: [
            { id: 1, tokenReclamo: 't1' },
            { id: 2, tokenReclamo: 't2' },
            { id: 3, tokenReclamo: 't3' },
          ],
          estado: 'APROBADA',
          solicitudId: 999,
          aprobadoPor: 1,
        },
        {
          type: 'body',
          metatype: CreateSolicitudInfraestructuraLinderosDto,
        },
      ),
    ).rejects.toBeDefined();
  });

  it('CASO 5 — FK: detalle con solicitudId inexistente falla', async () => {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    try {
      await expect(
        insertDetalle(qr, 999_999_888, {
          nis: 'NIS-X',
          tipoPersona: 'Persona física',
          calidadTitular: 'Propietario',
          provincia: 'San José',
          canton: 'Pérez Zeledón',
          distrito: 'San Isidro',
          direccionExacta: 'X',
          planoCatastrado: 'SJ',
          proposito: propositoUnico,
          medioNotificacionPrincipal: 'Teléfono',
        }),
      ).rejects.toThrow();
    } finally {
      await qr.release();
    }
  });

  it('CASO 6 — Propósito inventado rechazado por DTO', async () => {
    const dto = plainToInstance(CreateSolicitudInfraestructuraLinderosDto, {
      nis: 'NIS-1',
      tipoPersona: TipoPersonaInfraestructuraLinderos.FISICA,
      nombreFisica: 'Ana',
      apellidosFisica: 'Pérez',
      identificacionFisica: '1-1111-1111',
      telefonoFisica: '8888-1111',
      calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
      provincia: 'San José',
      canton: 'Pérez Zeledón',
      distrito: 'San Isidro',
      direccionExacta: 'Calle 1',
      planoCatastrado: 'SJ-1',
      planoAgrimensura: 'AG-1',
      proposito: 'Segundo propósito inventado',
      medioNotificacionPrincipal: MedioNotificacionCambioTitular.TELEFONO,
      documentos: [
        { id: 1, tokenReclamo: 't1' },
        { id: 2, tokenReclamo: 't2' },
        { id: 3, tokenReclamo: 't3' },
      ],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'proposito')).toBe(true);
  });

  it('INFRA-QA-002 — solo un propósito oficial confirmado en enum (segundo BLOCKED sin PDF)', () => {
    expect(Object.values(PropositoInfraestructuraLinderosConfirmado)).toEqual([
      'Reunión de fincas',
    ]);
  });
});
