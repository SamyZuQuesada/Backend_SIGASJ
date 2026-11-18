import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import {
  resolveReportCoords,
  toAdminDetail,
  toNullableCoord,
} from './averias.service';
import { Averia } from './entities/averia.entity';

describe('Averias — sector y coordenadas GPS', () => {
  describe('resolveReportCoords / toNullableCoord', () => {
    it('acepta el par lat/lng válido', () => {
      expect(resolveReportCoords(10.2188017, -85.5565018)).toEqual({
        latitud: 10.2188017,
        longitud: -85.5565018,
      });
    });

    it('acepta strings numéricos (SQL Server decimal/float)', () => {
      expect(resolveReportCoords('10.22', '-85.55')).toEqual({
        latitud: 10.22,
        longitud: -85.55,
      });
      expect(toNullableCoord('10.5')).toBe(10.5);
    });

    it('devuelve nulos si falta uno del par', () => {
      expect(resolveReportCoords(10.22, null)).toEqual({
        latitud: null,
        longitud: null,
      });
      expect(resolveReportCoords(undefined, -85.55)).toEqual({
        latitud: null,
        longitud: null,
      });
    });

    it('rechaza valores fuera de rango WGS84', () => {
      expect(resolveReportCoords(91, -85.55)).toEqual({
        latitud: null,
        longitud: null,
      });
      expect(resolveReportCoords(10.22, -181)).toEqual({
        latitud: null,
        longitud: null,
      });
    });
  });

  describe('mapeo admin con sector + coords', () => {
    const base = {
      id: 11,
      codigoSeguimiento: 'AV-2026-0011',
      fechaReporte: new Date('2026-11-17T15:00:00.000Z'),
      nombreReportante: 'Ana Rojas',
      identificacionReportante: '1-1111-1111',
      telefonoReportante: '8888-1111',
      correoReportante: null,
      idAbonado: null,
      sectorComunidad: 'Sector Norte',
      ubicacion: '200 m norte de la iglesia',
      latitud: 10.2205,
      longitud: -85.5571,
      descripcion: 'Fuga en tubería',
      estado: EstadoAveria.RECIBIDA,
      tipoAveria: null,
      prioridad: null,
      idFontaneroAsignado: null,
      fontaneroAsignado: null,
      idAyudante: null,
      ayudante: null,
      fechaAsignacion: null,
      fechaInicioAtencion: null,
      fechaResolucion: null,
      observacionesAtencion: null,
    } as Averia;

    it('incluye sector y GPS en el detalle administrativo', () => {
      const detail = toAdminDetail(base);
      expect(detail.sectorComunidad).toBe('Sector Norte');
      expect(detail.ubicacion).toBe('200 m norte de la iglesia');
      expect(detail.latitud).toBeCloseTo(10.2205, 5);
      expect(detail.longitud).toBeCloseTo(-85.5571, 5);
    });

    it('expone GPS nulo cuando el reporte no trajo coordenadas', () => {
      const sinGps = {
        ...base,
        latitud: null,
        longitud: null,
        sectorComunidad: 'Las Palmas',
      } as Averia;
      const detail = toAdminDetail(sinGps);
      expect(detail.sectorComunidad).toBe('Las Palmas');
      expect(detail.latitud).toBeNull();
      expect(detail.longitud).toBeNull();
    });

    it('normaliza par incompleto a nulos en el detalle', () => {
      const incompleto = {
        ...base,
        latitud: 10.22,
        longitud: null,
      } as Averia;
      const detail = toAdminDetail(incompleto);
      expect(detail.latitud).toBeNull();
      expect(detail.longitud).toBeNull();
    });
  });
});
