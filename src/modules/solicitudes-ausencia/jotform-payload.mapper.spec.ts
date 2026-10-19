import {
  normalizarTipoSolicitudAusencia,
  parseJotformWebhookPayload,
} from './jotform-payload.mapper';
import { TipoSolicitudAusencia } from '../../common/enums/tipo-solicitud-ausencia.enum';

const fields = {
  correlacion: 'correlacion',
  tipo: 'tipo',
  fechaInicio: 'fechaInicio',
  fechaFin: 'fechaFin',
  motivo: 'motivo',
};

describe('jotform-payload.mapper', () => {
  describe('normalizarTipoSolicitudAusencia', () => {
    it('mapea Permiso / Vacaciones a enums', () => {
      expect(normalizarTipoSolicitudAusencia('Permiso')).toBe(
        TipoSolicitudAusencia.PERMISO,
      );
      expect(normalizarTipoSolicitudAusencia('Vacaciones')).toBe(
        TipoSolicitudAusencia.VACACIONES,
      );
      expect(normalizarTipoSolicitudAusencia('PERMISO')).toBe(
        TipoSolicitudAusencia.PERMISO,
      );
    });

    it('rechaza INCAPACIDAD', () => {
      expect(() => normalizarTipoSolicitudAusencia('INCAPACIDAD')).toThrow(
        /inválido/i,
      );
    });
  });

  describe('parseJotformWebhookPayload', () => {
    it('parsea formato Jotform con submissionID y rawRequest', () => {
      const parsed = parseJotformWebhookPayload(
        {
          submissionID: '987654321',
          formID: 'form-real',
          rawRequest: JSON.stringify({
            correlacion: 'abc-token',
            tipo: 'Permiso',
            fechaInicio: '01/11/2026',
            fechaFin: '02/11/2026',
            motivo: 'Cita',
            colaboradorId: '999',
          }),
        },
        fields,
      );

      expect(parsed.jotformSubmissionId).toBe('987654321');
      expect(parsed.formId).toBe('form-real');
      expect(parsed.correlacionToken).toBe('abc-token');
      expect(parsed.tipo).toBe(TipoSolicitudAusencia.PERMISO);
      expect(parsed.fechaInicio).toBe('2026-11-01');
      expect(parsed.fechaFin).toBe('2026-11-02');
      expect(parsed.motivo).toBe('Cita');
    });

    it('exige submissionID', () => {
      expect(() =>
        parseJotformWebhookPayload({ formID: 'f', rawRequest: '{}' }, fields),
      ).toThrow(/submissionID/i);
    });
  });
});
