import { EntityManager } from 'typeorm';
import {
  ESTADO_AVERIA_LABELS,
  EstadoAveria,
} from '../../common/enums/estado-averia.enum';
import { TipoEventoAveria } from '../../common/enums/tipo-evento-averia.enum';
import { HistorialAveria } from './entities/historial-averia.entity';

const DESCRIPCION_MAX = 500;

const PRIORIDAD_LABEL: Record<string, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
};

const TIPO_LABEL: Record<string, string> = {
  TUBO_MADRE: 'Tubo madre',
  TUBO_MEDIDOR: 'Tubo medidor',
};

export type RegistrarEventoHistorialInput = {
  idAveria: number;
  tipoEvento: TipoEventoAveria;
  descripcion: string;
  estadoAnterior?: EstadoAveria | null;
  estadoNuevo?: EstadoAveria | null;
  idUsuario?: number | null;
  referenciaTipo?: string | null;
  referenciaId?: number | null;
};

export function etiquetaPrioridad(valor: string): string {
  return PRIORIDAD_LABEL[valor] ?? valor;
}

export function etiquetaTipoAveria(valor: string): string {
  return TIPO_LABEL[valor] ?? valor;
}

export function describirCambioEstado(
  anterior: EstadoAveria,
  nuevo: EstadoAveria,
): string {
  if (nuevo === EstadoAveria.PENDIENTE) {
    return 'Cambio a Pendiente de atención';
  }
  const desde = ESTADO_AVERIA_LABELS[anterior] ?? anterior;
  const hasta = ESTADO_AVERIA_LABELS[nuevo] ?? nuevo;
  return `Estado modificado de ${desde} a ${hasta}`;
}

export function describirCambioPrioridad(
  anterior: string | null,
  nueva: string,
): string {
  const destino = etiquetaPrioridad(nueva);
  if (!anterior) {
    return `Prioridad definida como ${destino}`;
  }
  return `Prioridad modificada de ${etiquetaPrioridad(anterior)} a ${destino}`;
}

export function describirClasificacion(
  anterior: string | null,
  nueva: string,
): string {
  const destino = etiquetaTipoAveria(nueva);
  if (!anterior) {
    return `Tipo de avería clasificado como ${destino}`;
  }
  return `Tipo de avería modificado de ${etiquetaTipoAveria(anterior)} a ${destino}`;
}

/**
 * Inserta un evento usando el EntityManager de la operación principal.
 * La fecha la fija la entidad al insertar. No actualiza filas existentes.
 * Si la conexión de prueba no registró la entidad, no interrumpe inventario.
 */
export async function registrarEventoHistorialEnManager(
  manager: EntityManager | undefined,
  input: RegistrarEventoHistorialInput,
): Promise<void> {
  if (!manager || typeof manager.getRepository !== 'function') {
    return;
  }

  let registra = false;
  try {
    registra =
      typeof manager.connection?.hasMetadata === 'function' &&
      manager.connection.hasMetadata(HistorialAveria);
  } catch {
    registra = false;
  }
  if (!registra) {
    return;
  }

  const descripcion = input.descripcion.trim().slice(0, DESCRIPCION_MAX);
  if (!descripcion) {
    throw new Error('La descripción del evento histórico es obligatoria.');
  }

  const repo = manager.getRepository(HistorialAveria);
  await repo.save(
    repo.create({
      idAveria: input.idAveria,
      tipoEvento: input.tipoEvento,
      descripcion,
      estadoAnterior: input.estadoAnterior ?? null,
      estadoNuevo: input.estadoNuevo ?? null,
      idUsuario: input.idUsuario ?? null,
      referenciaTipo: input.referenciaTipo ?? null,
      referenciaId: input.referenciaId ?? null,
    }),
  );
}
