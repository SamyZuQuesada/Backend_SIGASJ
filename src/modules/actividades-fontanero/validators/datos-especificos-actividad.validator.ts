import { TipoActividadFontaneroCodigo } from '../../../common/enums/tipo-actividad-fontanero-codigo.enum';

export type ValidacionDatosEspecificosInput = {
  codigo: TipoActividadFontaneroCodigo;
  datos?: Record<string, unknown>;
};

type ValidadorDatosEspecificos = (datos?: Record<string, unknown>) => string[];

const getString = (
  datos: Record<string, unknown> | undefined,
  ...keys: string[]
): string | undefined => {
  if (!datos) return undefined;
  for (const key of keys) {
    const val = datos[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return undefined;
};

const getPositiveNumber = (
  datos: Record<string, unknown> | undefined,
  ...keys: string[]
): number | undefined => {
  if (!datos) return undefined;
  for (const key of keys) {
    const val = datos[key];
    if (
      typeof val === 'number' &&
      !Number.isNaN(val) &&
      Number.isFinite(val) &&
      val > 0
    ) {
      return val;
    }
    if (typeof val === 'string' && val.trim() !== '') {
      const num = Number(val);
      if (!Number.isNaN(num) && Number.isFinite(num) && num > 0) {
        return num;
      }
    }
  }
  return undefined;
};

const getDocuments = (
  datos: Record<string, unknown> | undefined,
  ...keys: string[]
): string[] => {
  if (!datos) return [];
  for (const key of keys) {
    const val = datos[key];
    if (Array.isArray(val)) {
      const filtered = val
        .filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0,
        )
        .map((item) => item.trim());
      if (filtered.length > 0) {
        return filtered;
      }
    }
    if (typeof val === 'string' && val.trim().length > 0) {
      return [val.trim()];
    }
  }
  return [];
};

const validarControlFugas: ValidadorDatosEspecificos = (datos) => {
  const ubicacion = getString(
    datos,
    'ubicacionFuga',
    'ubicacion_fuga',
    'ubicacion',
  );
  if (!ubicacion) {
    return ['La ubicación de la fuga es obligatoria para el control de fugas'];
  }
  return [];
};

const validarTomaPresion: ValidadorDatosEspecificos = (datos) => {
  const presion = getPositiveNumber(
    datos,
    'presionMedida',
    'presion_medida',
    'presion',
  );
  if (presion === undefined) {
    return [
      'La presión medida es obligatoria y debe ser un valor numérico positivo para la toma de presión',
    ];
  }
  return [];
};

const validarVisitaCampo: ValidadorDatosEspecificos = (datos) => {
  const resultado = getString(
    datos,
    'resultadoVisita',
    'resultado_visita',
    'resultado',
  );
  if (!resultado) {
    return [
      'El resultado de la visita de campo es obligatorio para la visita de campo',
    ];
  }
  return [];
};

const validarControlCloros: ValidadorDatosEspecificos = (datos) => {
  const cloro = getPositiveNumber(
    datos,
    'cantidadCloro',
    'cantidad_cloro',
    'cloro',
  );
  if (cloro === undefined) {
    return [
      'La cantidad de cloro es obligatoria y debe ser un valor numérico positivo para el control de cloros',
    ];
  }
  return [];
};

const validarControlOperativo: ValidadorDatosEspecificos = (datos) => {
  const caudal = getPositiveNumber(datos, 'caudal');
  if (caudal === undefined) {
    return [
      'El caudal es obligatorio y debe ser un valor numérico positivo para el control operativo',
    ];
  }
  return [];
};

const validarIncapacidadVacaciones: ValidadorDatosEspecificos = (datos) => {
  const docs = getDocuments(
    datos,
    'documentos',
    'comprobante',
    'comprobanteMedico',
    'listaMateriales',
  );
  if (docs.length === 0) {
    return [
      'Debe adjuntar al menos un documento (comprobante médico o lista de materiales) para incapacidades o vacaciones',
    ];
  }
  return [];
};

const VALIDADORES_POR_CODIGO: Record<
  TipoActividadFontaneroCodigo,
  ValidadorDatosEspecificos
> = {
  [TipoActividadFontaneroCodigo.CONTROL_FUGAS]: validarControlFugas,
  [TipoActividadFontaneroCodigo.TOMA_PRESION]: validarTomaPresion,
  [TipoActividadFontaneroCodigo.VISITA_CAMPO]: validarVisitaCampo,
  [TipoActividadFontaneroCodigo.CONTROL_CLOROS]: validarControlCloros,
  [TipoActividadFontaneroCodigo.CONTROL_OPERATIVO]: validarControlOperativo,
  [TipoActividadFontaneroCodigo.INCAPACIDAD_VACACIONES]:
    validarIncapacidadVacaciones,
};

export const validarDatosEspecificosActividad = (
  input: ValidacionDatosEspecificosInput,
): string[] => {
  const validar = VALIDADORES_POR_CODIGO[input.codigo];
  if (!validar) {
    return ['El tipo de actividad no admite validaciones específicas'];
  }
  return validar(input.datos);
};
