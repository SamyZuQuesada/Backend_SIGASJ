import { Repository } from 'typeorm';
import { TipoActividadFontaneroCodigo } from '../../../common/enums/tipo-actividad-fontanero-codigo.enum';
import { TipoActividadFontanero } from '../entities/tipo-actividad-fontanero.entity';

const CATALOGO_TIPOS: Array<{
  codigo: TipoActividadFontaneroCodigo;
  nombre: string;
  descripcion: string;
  orden: number;
  activo?: boolean;
}> = [
  {
    codigo: TipoActividadFontaneroCodigo.CONTROL_FUGAS,
    nombre: 'Control de Fugas',
    descripcion: 'Registro de control de fugas en la red de distribución.',
    orden: 1,
  },
  {
    codigo: TipoActividadFontaneroCodigo.TOMA_PRESION,
    nombre: 'Toma de presión',
    descripcion: 'Medición de presión en puntos operativos de la red.',
    orden: 2,
  },
  {
    codigo: TipoActividadFontaneroCodigo.VISITA_CAMPO,
    nombre: 'Visita de Campo',
    descripcion: 'Visita operativa en campo para seguimiento o atención.',
    orden: 3,
  },
  {
    codigo: TipoActividadFontaneroCodigo.CONTROL_CLOROS,
    nombre: 'Control de Cloros',
    descripcion: 'Control de niveles de cloro en el sistema de tratamiento.',
    orden: 4,
  },
  {
    codigo: TipoActividadFontaneroCodigo.CONTROL_OPERATIVO,
    nombre: 'Control Operativo',
    descripcion: 'Registro de actividades operativas generales.',
    orden: 5,
  },
  {
    codigo: TipoActividadFontaneroCodigo.INCAPACIDAD_VACACIONES,
    nombre: 'Incapacidad o vacaciones',
    descripcion: 'Registro de incapacidad o periodo de vacaciones del fontanero.',
    orden: 6,
  },
];

export async function seedTiposActividadFontanero(
  repository: Repository<TipoActividadFontanero>,
): Promise<TipoActividadFontanero[]> {
  const existing = await repository.count();
  if (existing > 0) {
    return repository.find({ order: { id: 'ASC' } });
  }

  const tipos = CATALOGO_TIPOS.map((item) =>
    repository.create({
      codigo: item.codigo,
      nombre: item.nombre,
      descripcion: item.descripcion,
      orden: item.orden,
      activo: item.activo ?? true,
    }),
  );

  return repository.save(tipos);
}

export const buildValidCreateActividadPayload = (
  tipoActividadId = 1,
  overrides: Record<string, unknown> = {},
) => ({
  tipoActividadId,
  fechaActividad: '2026-09-07',
  titulo: 'Reparación de tubería en Calle Principal',
  descripcion: 'Se reemplazó tramo dañado de 2 metros',
  ubicacion: 'Calle Principal, San Juan',
  observaciones: 'Sin novedad adicional',
  ubicacionFuga: 'Calle Principal, San Juan',
  presionMedida: 45.5,
  resultadoVisita: 'Inspección realizada en sitio',
  cantidadCloro: 1.2,
  caudal: 25.0,
  documentos: ['comprobante_medico.pdf'],
  ...overrides,
});
