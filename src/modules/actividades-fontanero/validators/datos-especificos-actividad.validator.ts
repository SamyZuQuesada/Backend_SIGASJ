import { TipoActividadFontaneroCodigo } from '../../../common/enums/tipo-actividad-fontanero-codigo.enum';

export type ValidacionDatosEspecificosInput = {
  codigo: TipoActividadFontaneroCodigo;
  /** Campos del formulario específico (backlogs futuros). */
  datos?: Record<string, unknown>;
};

type ValidadorDatosEspecificos = (
  datos?: Record<string, unknown>,
) => string[];

const sinValidacionesAdicionales: ValidadorDatosEspecificos = () => [];

/** Registro extensible: cada tipo puede añadir reglas propias sin mezclar formularios. */
const VALIDADORES_POR_CODIGO: Record<
  TipoActividadFontaneroCodigo,
  ValidadorDatosEspecificos
> = {
  [TipoActividadFontaneroCodigo.CONTROL_FUGAS]: sinValidacionesAdicionales,
  [TipoActividadFontaneroCodigo.TOMA_PRESION]: sinValidacionesAdicionales,
  [TipoActividadFontaneroCodigo.VISITA_CAMPO]: sinValidacionesAdicionales,
  [TipoActividadFontaneroCodigo.CONTROL_CLOROS]: sinValidacionesAdicionales,
  [TipoActividadFontaneroCodigo.CONTROL_OPERATIVO]: sinValidacionesAdicionales,
  [TipoActividadFontaneroCodigo.INCAPACIDAD_VACACIONES]:
    sinValidacionesAdicionales,
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
