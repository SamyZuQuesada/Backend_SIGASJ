import { TipoActividadFontaneroCodigo } from '../../../common/enums/tipo-actividad-fontanero-codigo.enum';
import { validarDatosEspecificosActividad } from './datos-especificos-actividad.validator';

describe('validarDatosEspecificosActividad', () => {
  describe('CONTROL_FUGAS', () => {
    it('acepta payload con ubicación de fuga válida', () => {
      const errores = validarDatosEspecificosActividad({
        codigo: TipoActividadFontaneroCodigo.CONTROL_FUGAS,
        datos: { ubicacionFuga: 'Sector 3 Calle Principal' },
      });
      expect(errores).toEqual([]);
    });

    it('rechaza si falta la ubicación de la fuga o si está vacía', () => {
      const errores1 = validarDatosEspecificosActividad({
        codigo: TipoActividadFontaneroCodigo.CONTROL_FUGAS,
        datos: {},
      });
      expect(errores1).toContain(
        'La ubicación de la fuga es obligatoria para el control de fugas',
      );

      const errores2 = validarDatosEspecificosActividad({
        codigo: TipoActividadFontaneroCodigo.CONTROL_FUGAS,
        datos: { ubicacionFuga: '   ' },
      });
      expect(errores2).toContain(
        'La ubicación de la fuga es obligatoria para el control de fugas',
      );
    });
  });

  describe('TOMA_PRESION', () => {
    it('acepta payload con presión medida positiva', () => {
      const errores = validarDatosEspecificosActividad({
        codigo: TipoActividadFontaneroCodigo.TOMA_PRESION,
        datos: { presionMedida: 45.5 },
      });
      expect(errores).toEqual([]);
    });

    it('rechaza presión medida ausente, no numérica o menor o igual a cero', () => {
      const sinPresion = validarDatosEspecificosActividad({
        codigo: TipoActividadFontaneroCodigo.TOMA_PRESION,
        datos: {},
      });
      expect(sinPresion).toContain(
        'La presión medida es obligatoria y debe ser un valor numérico positivo para la toma de presión',
      );

      const presionCero = validarDatosEspecificosActividad({
        codigo: TipoActividadFontaneroCodigo.TOMA_PRESION,
        datos: { presionMedida: 0 },
      });
      expect(presionCero).toContain(
        'La presión medida es obligatoria y debe ser un valor numérico positivo para la toma de presión',
      );

      const presionNegativa = validarDatosEspecificosActividad({
        codigo: TipoActividadFontaneroCodigo.TOMA_PRESION,
        datos: { presionMedida: -10 },
      });
      expect(presionNegativa).toContain(
        'La presión medida es obligatoria y debe ser un valor numérico positivo para la toma de presión',
      );
    });
  });

  describe('VISITA_CAMPO', () => {
    it('acepta payload con resultado de visita válido', () => {
      const errores = validarDatosEspecificosActividad({
        codigo: TipoActividadFontaneroCodigo.VISITA_CAMPO,
        datos: { resultadoVisita: 'Medidor verificado en sitio' },
      });
      expect(errores).toEqual([]);
    });

    it('rechaza resultado de visita ausente o vacío', () => {
      const errores = validarDatosEspecificosActividad({
        codigo: TipoActividadFontaneroCodigo.VISITA_CAMPO,
        datos: {},
      });
      expect(errores).toContain(
        'El resultado de la visita de campo es obligatorio para la visita de campo',
      );
    });
  });

  describe('CONTROL_CLOROS', () => {
    it('acepta payload con cantidad de cloro válida', () => {
      const errores = validarDatosEspecificosActividad({
        codigo: TipoActividadFontaneroCodigo.CONTROL_CLOROS,
        datos: { cantidadCloro: 1.2 },
      });
      expect(errores).toEqual([]);
    });

    it('rechaza cantidad de cloro ausente o no positiva', () => {
      const errores = validarDatosEspecificosActividad({
        codigo: TipoActividadFontaneroCodigo.CONTROL_CLOROS,
        datos: { cantidadCloro: 0 },
      });
      expect(errores).toContain(
        'La cantidad de cloro es obligatoria y debe ser un valor numérico positivo para el control de cloros',
      );
    });
  });

  describe('CONTROL_OPERATIVO', () => {
    it('acepta payload con caudal positivo', () => {
      const errores = validarDatosEspecificosActividad({
        codigo: TipoActividadFontaneroCodigo.CONTROL_OPERATIVO,
        datos: { caudal: 25.4 },
      });
      expect(errores).toEqual([]);
    });

    it('rechaza caudal ausente o no positivo', () => {
      const errores = validarDatosEspecificosActividad({
        codigo: TipoActividadFontaneroCodigo.CONTROL_OPERATIVO,
        datos: {},
      });
      expect(errores).toContain(
        'El caudal es obligatorio y debe ser un valor numérico positivo para el control operativo',
      );
    });
  });

  describe('INCAPACIDAD_VACACIONES', () => {
    it('acepta payload con documentos adjuntos válidos', () => {
      const errores = validarDatosEspecificosActividad({
        codigo: TipoActividadFontaneroCodigo.INCAPACIDAD_VACACIONES,
        datos: { documentos: ['comprobante_medico.pdf'] },
      });
      expect(errores).toEqual([]);
    });

    it('rechaza si no se adjuntan documentos o la lista está vacía', () => {
      const errores = validarDatosEspecificosActividad({
        codigo: TipoActividadFontaneroCodigo.INCAPACIDAD_VACACIONES,
        datos: { documentos: [] },
      });
      expect(errores).toContain(
        'Debe adjuntar al menos un documento (comprobante médico o lista de materiales) para incapacidades o vacaciones',
      );
    });
  });
});
