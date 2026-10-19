import { getMetadataArgsStorage } from 'typeorm';
import {
  EstadoSolicitudAusencia,
  ESTADOS_SOLICITUD_AUSENCIA,
  isEstadoSolicitudAusenciaValido,
} from '../../../common/enums/estado-solicitud-ausencia.enum';
import {
  TIPOS_SOLICITUD_AUSENCIA,
  TipoSolicitudAusencia,
} from '../../../common/enums/tipo-solicitud-ausencia.enum';
import { Colaborador } from '../../recursos-humanos/entities/colaborador.entity';
import { SolicitudAusencia } from './solicitud-ausencia.entity';

describe('SolicitudAusencia Entity (SIGASJ / PBI 6.5.1)', () => {
  describe('Enums', () => {
    it('tipo solo admite PERMISO y VACACIONES', () => {
      expect(TIPOS_SOLICITUD_AUSENCIA).toEqual([
        TipoSolicitudAusencia.PERMISO,
        TipoSolicitudAusencia.VACACIONES,
      ]);
      expect(TipoSolicitudAusencia.PERMISO).toBe('PERMISO');
      expect(TipoSolicitudAusencia.VACACIONES).toBe('VACACIONES');
    });

    it('estado solo admite PENDIENTE, APROBADA y RECHAZADA', () => {
      expect(ESTADOS_SOLICITUD_AUSENCIA).toEqual([
        EstadoSolicitudAusencia.PENDIENTE,
        EstadoSolicitudAusencia.APROBADA,
        EstadoSolicitudAusencia.RECHAZADA,
      ]);
      expect(isEstadoSolicitudAusenciaValido('PENDIENTE')).toBe(true);
      expect(isEstadoSolicitudAusenciaValido('APROBADA')).toBe(true);
      expect(isEstadoSolicitudAusenciaValido('RECHAZADA')).toBe(true);
      expect(isEstadoSolicitudAusenciaValido('INCAPACIDAD')).toBe(false);
    });
  });

  describe('Instanciación', () => {
    it('existe y puede representar una solicitud PERMISO PENDIENTE', () => {
      const solicitud = new SolicitudAusencia();
      const colaborador = new Colaborador();
      colaborador.id = 7;

      solicitud.id = 1;
      solicitud.colaboradorId = 7;
      solicitud.colaborador = colaborador;
      solicitud.tipo = TipoSolicitudAusencia.PERMISO;
      solicitud.fechaInicio = '2026-11-01';
      solicitud.fechaFin = '2026-11-02';
      solicitud.motivo = 'Trámite personal';
      solicitud.observaciones = null;
      solicitud.estado = EstadoSolicitudAusencia.PENDIENTE;
      solicitud.jotformSubmissionId = 'sub-abc-1';
      solicitud.reviewedAt = null;
      solicitud.reviewedByUsuarioId = null;
      solicitud.motivoRechazo = null;

      expect(solicitud).toBeInstanceOf(SolicitudAusencia);
      expect(solicitud.tipo).toBe(TipoSolicitudAusencia.PERMISO);
      expect(solicitud.estado).toBe(EstadoSolicitudAusencia.PENDIENTE);
      expect(solicitud.colaborador.id).toBe(7);
      expect(solicitud.fechaInicio).toBe('2026-11-01');
      expect(solicitud.fechaFin).toBe('2026-11-02');
      expect(solicitud.motivo).toBe('Trámite personal');
      expect(solicitud.observaciones).toBeNull();
      expect(solicitud.reviewedByUsuarioId).toBeNull();
      expect(solicitud.jotformSubmissionId).toBe('sub-abc-1');
    });

    it('puede representar VACACIONES APROBADA con datos de revisión', () => {
      const solicitud = new SolicitudAusencia();
      const revisado = new Date('2026-10-19T15:00:00Z');

      solicitud.tipo = TipoSolicitudAusencia.VACACIONES;
      solicitud.estado = EstadoSolicitudAusencia.APROBADA;
      solicitud.fechaInicio = '2026-12-01';
      solicitud.fechaFin = '2026-12-05';
      solicitud.motivo = 'Descanso anual';
      solicitud.observaciones = 'Aprobado por administración';
      solicitud.reviewedAt = revisado;
      solicitud.reviewedByUsuarioId = 18;
      solicitud.jotformSubmissionId = 'sub-vac-9';

      expect(solicitud.tipo).toBe(TipoSolicitudAusencia.VACACIONES);
      expect(solicitud.estado).toBe(EstadoSolicitudAusencia.APROBADA);
      expect(solicitud.observaciones).toBe('Aprobado por administración');
      expect(solicitud.reviewedAt).toEqual(revisado);
      expect(solicitud.reviewedByUsuarioId).toBe(18);
    });

    it('puede representar RECHAZADA con motivo de rechazo', () => {
      const solicitud = new SolicitudAusencia();
      solicitud.estado = EstadoSolicitudAusencia.RECHAZADA;
      solicitud.motivoRechazo = 'Sin cobertura operativa';
      solicitud.observaciones = null;
      solicitud.reviewedByUsuarioId = 18;

      expect(solicitud.estado).toBe(EstadoSolicitudAusencia.RECHAZADA);
      expect(solicitud.motivoRechazo).toBe('Sin cobertura operativa');
    });
  });

  describe('Hooks', () => {
    it('asigna PENDIENTE por defecto al insertar', () => {
      const solicitud = new SolicitudAusencia();
      solicitud.asignarValoresPorDefecto();
      expect(solicitud.estado).toBe(EstadoSolicitudAusencia.PENDIENTE);
    });

    it('normaliza fechas, motivo, observaciones y jotformSubmissionId', () => {
      const solicitud = new SolicitudAusencia();
      solicitud.fechaInicio = '2026-11-01T00:00:00.000Z';
      solicitud.fechaFin = '2026-11-03T12:00:00.000Z';
      solicitud.motivo = '  Cita  ';
      solicitud.observaciones = '  Nota admin  ';
      solicitud.motivoRechazo = '';
      solicitud.jotformSubmissionId = '  sub-trim  ';

      solicitud.normalizar();

      expect(solicitud.fechaInicio).toBe('2026-11-01');
      expect(solicitud.fechaFin).toBe('2026-11-03');
      expect(solicitud.motivo).toBe('Cita');
      expect(solicitud.observaciones).toBe('Nota admin');
      expect(solicitud.motivoRechazo).toBeNull();
      expect(solicitud.jotformSubmissionId).toBe('sub-trim');
    });

    it('hidrata fechas al cargar', () => {
      const solicitud = new SolicitudAusencia();
      solicitud.fechaInicio = '2026-08-10T00:00:00.000Z';
      solicitud.fechaFin = '2026-08-12T00:00:00.000Z';
      solicitud.hidratarFechas();
      expect(solicitud.fechaInicio).toBe('2026-08-10');
      expect(solicitud.fechaFin).toBe('2026-08-12');
    });
  });

  describe('Metadatos TypeORM', () => {
    it('mapea tabla SolicitudAusencia con FK a Colaborador e índices requeridos', () => {
      const storage = getMetadataArgsStorage();
      const table = storage.tables.find((t) => t.target === SolicitudAusencia);
      expect(table?.name).toBe('SolicitudAusencia');

      const columns = storage.columns
        .filter((c) => c.target === SolicitudAusencia)
        .map((c) => c.propertyName);
      expect(columns).toEqual(
        expect.arrayContaining([
          'id',
          'colaboradorId',
          'tipo',
          'fechaInicio',
          'fechaFin',
          'motivo',
          'observaciones',
          'estado',
          'jotformSubmissionId',
          'reviewedAt',
          'reviewedByUsuarioId',
          'motivoRechazo',
          'createdAt',
          'updatedAt',
        ]),
      );

      const relations = storage.relations.filter(
        (r) => r.target === SolicitudAusencia,
      );
      expect(
        relations.some(
          (r) =>
            r.propertyName === 'colaborador' &&
            r.relationType === 'many-to-one',
        ),
      ).toBe(true);
      expect(
        relations.some(
          (r) =>
            r.propertyName === 'revisadoPor' &&
            r.relationType === 'many-to-one',
        ),
      ).toBe(true);

      const indices = storage.indices.filter(
        (i) => i.target === SolicitudAusencia,
      );
      const indexNames = indices.map((i) => i.name);
      expect(indexNames).toEqual(
        expect.arrayContaining([
          'IX_SolicitudAusencia_colaboradorId',
          'IX_SolicitudAusencia_estado',
          'UQ_SolicitudAusencia_jotformSubmissionId',
        ]),
      );
      const uniqueJotform = indices.find(
        (i) => i.name === 'UQ_SolicitudAusencia_jotformSubmissionId',
      );
      expect(uniqueJotform?.unique).toBe(true);
    });
  });
});
