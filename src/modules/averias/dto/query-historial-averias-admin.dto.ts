import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoAveria } from '../../../common/enums/estado-averia.enum';
import { PrioridadAveria } from '../../../common/enums/prioridad-averia.enum';
import { TipoAveria } from '../../../common/enums/tipo-averia.enum';
import {
  ADMIN_AVERIAS_LIMIT_DEFAULT,
  ADMIN_AVERIAS_LIMIT_MAX,
  ADMIN_AVERIAS_PAGE_DEFAULT,
  ADMIN_AVERIAS_PRIORIDAD_SIN_ASIGNAR,
} from './query-averias-admin.dto';

const ESTADOS_HISTORIAL_POR_ETIQUETA: Record<string, EstadoAveria> = {
  RECIBIDA: EstadoAveria.RECIBIDA,
  'EN REVISION': EstadoAveria.EN_REVISION,
  ASIGNADA: EstadoAveria.ASIGNADA,
  'EN ATENCION': EstadoAveria.EN_ATENCION,
  PENDIENTE: EstadoAveria.PENDIENTE,
  'PENDIENTE DE ATENCION': EstadoAveria.PENDIENTE,
  RESUELTA: EstadoAveria.RESUELTA,
  CANCELADA: EstadoAveria.CANCELADA,
};

const PRIORIDADES_HISTORIAL = [
  ...Object.values(PrioridadAveria),
  ADMIN_AVERIAS_PRIORIDAD_SIN_ASIGNAR,
] as const;

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

/** Compara etiquetas con y sin tilde: "En atención" y "Resuelta". */
export function plegarTextoFiltro(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function normalizarEstadoHistorial(value: string): string {
  const folded = plegarTextoFiltro(value);
  return ESTADOS_HISTORIAL_POR_ETIQUETA[folded] ?? folded.replace(/ /g, '_');
}

export function normalizarPrioridadHistorial(value: string): string {
  const folded = plegarTextoFiltro(value);
  if (folded === 'SIN ASIGNAR') {
    return ADMIN_AVERIAS_PRIORIDAD_SIN_ASIGNAR;
  }
  return folded.replace(/ /g, '_');
}

export function normalizarTipoHistorial(value: string): string {
  return plegarTextoFiltro(value).replace(/ /g, '_');
}

const trimOptionalString = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== 'string') {
    return raw;
  }
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
};

const toOptionalInt = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'number') {
    return Number.isInteger(raw) ? raw : Number.NaN;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') {
      return undefined;
    }
    if (!/^-?\d+$/.test(trimmed)) {
      return Number.NaN;
    }
    return parseInt(trimmed, 10);
  }
  return raw;
};

const toOptionalEstadoHistorial = (params: TransformFnParams): unknown => {
  const raw = trimOptionalString(params);
  if (typeof raw !== 'string') {
    return raw;
  }
  return normalizarEstadoHistorial(raw);
};

const toOptionalPrioridadHistorial = (params: TransformFnParams): unknown => {
  const raw = trimOptionalString(params);
  if (typeof raw !== 'string') {
    return raw;
  }
  return normalizarPrioridadHistorial(raw);
};

const toOptionalTipoHistorial = (params: TransformFnParams): unknown => {
  const raw = trimOptionalString(params);
  if (typeof raw !== 'string') {
    return raw;
  }
  return normalizarTipoHistorial(raw);
};

/**
 * Consulta del historial general de averías.
 * Acepta el valor persistido (RESUELTA, ALTA, TUBO_MADRE) o la etiqueta
 * (Resuelta, Alta, Tubo madre). No acepta Reportada ni En proceso.
 */
export class QueryHistorialAveriasAdminDto {
  @ApiPropertyOptional({
    description: 'Número de página (inicia en 1)',
    example: 1,
    minimum: 1,
    default: ADMIN_AVERIAS_PAGE_DEFAULT,
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number = ADMIN_AVERIAS_PAGE_DEFAULT;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por página',
    example: 20,
    minimum: 1,
    maximum: ADMIN_AVERIAS_LIMIT_MAX,
    default: ADMIN_AVERIAS_LIMIT_DEFAULT,
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(ADMIN_AVERIAS_LIMIT_MAX, {
    message: `limit no puede exceder ${ADMIN_AVERIAS_LIMIT_MAX} registros por página`,
  })
  limit?: number = ADMIN_AVERIAS_LIMIT_DEFAULT;

  @ApiPropertyOptional({
    enum: EstadoAveria,
    enumName: 'EstadoAveria',
    description:
      'Estado vigente. Acepta el valor persistido o la etiqueta (Recibida, Asignada, Pendiente de atención, En atención, Resuelta). Reportada y En proceso no son válidos.',
    example: EstadoAveria.RESUELTA,
  })
  @Transform(toOptionalEstadoHistorial)
  @IsOptional()
  @IsEnum(EstadoAveria, {
    message: `El estado debe ser uno de los vigentes: ${Object.values(EstadoAveria).join(', ')}`,
  })
  estado?: EstadoAveria;

  @ApiPropertyOptional({
    description:
      'Prioridad persistida (BAJA, MEDIA, ALTA, URGENTE) o etiqueta (Baja, Media, Alta). SIN_ASIGNAR filtra prioridad nula.',
    example: PrioridadAveria.ALTA,
  })
  @Transform(toOptionalPrioridadHistorial)
  @IsOptional()
  @IsIn(PRIORIDADES_HISTORIAL, {
    message: `La prioridad debe ser una de: ${PRIORIDADES_HISTORIAL.join(', ')}`,
  })
  prioridad?: (typeof PRIORIDADES_HISTORIAL)[number];

  @ApiPropertyOptional({
    enum: TipoAveria,
    enumName: 'TipoAveria',
    description:
      'Tipo persistido en tipoAveria. Acepta el valor o la etiqueta (Tubo madre, Tubo medidor).',
    example: TipoAveria.TUBO_MADRE,
  })
  @Transform(toOptionalTipoHistorial)
  @IsOptional()
  @IsEnum(TipoAveria, {
    message: `El tipo debe ser uno de: ${Object.values(TipoAveria).join(', ')}`,
  })
  tipo?: TipoAveria;

  @ApiPropertyOptional({
    description: 'ID del Usuario con rol FONTANERO asignado',
    example: 5,
    minimum: 1,
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'fontaneroId debe ser un número entero' })
  @Min(1, { message: 'fontaneroId debe ser un entero positivo' })
  fontaneroId?: number;

  @ApiPropertyOptional({
    description:
      'Coincidencia exacta, sin distinguir mayúsculas, sobre sectorComunidad',
    example: 'San Juan',
    maxLength: 150,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'sector debe ser una cadena de texto' })
  @MaxLength(150, { message: 'sector no puede exceder 150 caracteres' })
  sector?: string;

  @ApiPropertyOptional({
    description:
      'Inicio inclusivo del rango sobre fechaReporte (día calendario YYYY-MM-DD)',
    example: '2026-08-01',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaDesde debe tener formato YYYY-MM-DD',
  })
  fechaDesde?: string;

  @ApiPropertyOptional({
    description:
      'Fin inclusivo del rango sobre fechaReporte (todo el día YYYY-MM-DD)',
    example: '2026-08-31',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaHasta debe tener formato YYYY-MM-DD',
  })
  fechaHasta?: string;

  @ApiPropertyOptional({
    description:
      'Búsqueda parcial por codigoSeguimiento. No busca por nombre del Reportante.',
    example: 'AV-2026-0042',
    maxLength: 40,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'codigoSeguimiento debe ser una cadena de texto' })
  @MaxLength(40, {
    message: 'codigoSeguimiento no puede exceder 40 caracteres',
  })
  codigoSeguimiento?: string;
}
