import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TipoEventoHistorialRrhh,
  TIPOS_EVENTO_HISTORIAL_RRHH,
} from '../../../common/enums/tipo-evento-historial-rrhh.enum';
import {
  TipoMovimientoVacaciones,
  TIPOS_MOVIMIENTO_VACACIONES,
} from '../../../common/enums/tipo-movimiento-vacaciones.enum';

/**
 * Resumen del colaborador en la respuesta de historial.
 * Solo identifica a la persona; no incluye usuario ni credenciales.
 */
export class HistorialColaboradorResumenDto {
  @ApiProperty({ example: 3 })
  id: number;

  @ApiProperty({ example: 'Carlos' })
  nombre: string;

  @ApiProperty({ example: 'Pérez Mora' })
  apellidos: string;

  @ApiProperty({ example: '1-1234-0567' })
  cedula: string;

  @ApiProperty({ example: 'Fontanero' })
  cargo: string;
}

/**
 * Evento unificado del historial administrativo.
 *
 * `fecha` es la clave cronológica:
 * - PERMISO → fechaInicio
 * - VACACION → fecha del movimiento
 * - INCAPACIDAD → fechaInicio
 */
export class EventoHistorialColaboradorDto {
  @ApiProperty({ example: 15 })
  id: number;

  @ApiProperty({
    enum: TIPOS_EVENTO_HISTORIAL_RRHH,
    example: TipoEventoHistorialRrhh.INCAPACIDAD,
  })
  tipo: TipoEventoHistorialRrhh;

  @ApiProperty({
    example: '2026-10-10',
    description: 'Fecha usada para ordenar el historial (YYYY-MM-DD)',
  })
  fecha: string;

  @ApiPropertyOptional({
    example: '2026-10-10',
    nullable: true,
    description: 'Inicio del periodo cuando aplica (permiso/incapacidad)',
  })
  fechaInicio: string | null;

  @ApiPropertyOptional({
    example: '2026-10-12',
    nullable: true,
    description: 'Fin del periodo cuando aplica (permiso/incapacidad)',
  })
  fechaFin: string | null;

  @ApiProperty({
    example: 'Documento entregado a administración',
    description: 'Resumen legible del evento',
  })
  descripcion: string;

  @ApiPropertyOptional({
    example: 'Cita médica',
    nullable: true,
    description: 'Motivo del permiso (solo tipo PERMISO)',
  })
  motivo?: string | null;

  @ApiPropertyOptional({
    enum: TIPOS_MOVIMIENTO_VACACIONES,
    example: TipoMovimientoVacaciones.DISFRUTADO,
    description: 'Tipo del movimiento de vacaciones (solo tipo VACACION)',
  })
  tipoMovimiento?: TipoMovimientoVacaciones;

  @ApiPropertyOptional({
    example: 5,
    description: 'Días del movimiento de vacaciones (solo tipo VACACION)',
  })
  cantidadDias?: number;

  @ApiPropertyOptional({
    example: 'Documento entregado a administración',
    nullable: true,
    description: 'Observaciones administrativas cuando existen',
  })
  observaciones?: string | null;
}

export class HistorialColaboradorResponseDto {
  @ApiProperty({ type: HistorialColaboradorResumenDto })
  colaborador: HistorialColaboradorResumenDto;

  @ApiProperty({
    type: [EventoHistorialColaboradorDto],
    description: 'Página de eventos del historial (más reciente primero)',
  })
  historial: EventoHistorialColaboradorDto[];

  @ApiProperty({
    example: 25,
    description: 'Total de eventos que cumplen filtros',
  })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({
    example: 3,
    description: 'Cantidad de páginas; 0 si no hay eventos',
  })
  totalPages: number;
}
