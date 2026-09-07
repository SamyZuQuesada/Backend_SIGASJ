import { TipoActividadFontaneroCodigo } from '../../common/enums/tipo-actividad-fontanero-codigo.enum';

export const TIPOS_ACTIVIDAD_FONTANERO_INICIALES = [
  {
    codigo: TipoActividadFontaneroCodigo.CONTROL_FUGAS,
    nombre: 'Control de Fugas',
    orden: 1,
  },
  {
    codigo: TipoActividadFontaneroCodigo.TOMA_PRESION,
    nombre: 'Toma de presión',
    orden: 2,
  },
  {
    codigo: TipoActividadFontaneroCodigo.VISITA_CAMPO,
    nombre: 'Visita de Campo',
    orden: 3,
  },
  {
    codigo: TipoActividadFontaneroCodigo.CONTROL_CLOROS,
    nombre: 'Control de Cloros',
    orden: 4,
  },
  {
    codigo: TipoActividadFontaneroCodigo.CONTROL_OPERATIVO,
    nombre: 'Control Operativo',
    orden: 5,
  },
  {
    codigo: TipoActividadFontaneroCodigo.INCAPACIDAD_VACACIONES,
    nombre: 'Incapacidad o vacaciones',
    orden: 6,
  },
] as const;
