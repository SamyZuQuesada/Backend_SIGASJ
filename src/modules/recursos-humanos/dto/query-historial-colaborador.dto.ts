import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  TIPOS_EVENTO_HISTORIAL_RRHH,
  TipoEventoHistorialRrhh,
} from '../../../common/enums/tipo-evento-historial-rrhh.enum';

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

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

const trimOptionalUpperString = (params: TransformFnParams): unknown => {
  const value = trimOptionalString(params);
  return typeof value === 'string' ? value.toUpperCase() : value;
};

const toOptionalInt = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed === '' ? undefined : Number(trimmed);
  }
  return raw;
};

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export const HISTORIAL_PAGE_DEFAULT = 1;
export const HISTORIAL_LIMIT_DEFAULT = 10;
export const HISTORIAL_LIMIT_MAX = 100;

/**
 * Query del historial administrativo consolidado.
 *
 * - tipo: limita a un origen (PERMISO | VACACION | INCAPACIDAD)
 * - fechaDesde / fechaHasta: filtran por la fecha cronológica del evento
 *   (PERMISO/INCAPACIDAD → fechaInicio; VACACION → fecha del movimiento)
 */
export class QueryHistorialColaboradorDto {
  @ApiPropertyOptional({
    enum: TipoEventoHistorialRrhh,
    description: 'Filtrar por tipo de evento del historial',
  })
  @Transform(trimOptionalUpperString)
  @IsOptional()
  @IsEnum(TipoEventoHistorialRrhh, {
    message: `tipo debe ser ${TIPOS_EVENTO_HISTORIAL_RRHH.join(', ')}`,
  })
  tipo?: TipoEventoHistorialRrhh;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description:
      'Incluir eventos con fecha cronológica igual o posterior (YYYY-MM-DD)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'fechaDesde debe ser una cadena de texto' })
  @Matches(FECHA_ISO, {
    message: 'fechaDesde debe tener formato YYYY-MM-DD',
  })
  fechaDesde?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description:
      'Incluir eventos con fecha cronológica igual o anterior (YYYY-MM-DD)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'fechaHasta debe ser una cadena de texto' })
  @Matches(FECHA_ISO, {
    message: 'fechaHasta debe tener formato YYYY-MM-DD',
  })
  fechaHasta?: string;

  @ApiPropertyOptional({
    minimum: 1,
    default: HISTORIAL_PAGE_DEFAULT,
    description: 'Número de página',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number = HISTORIAL_PAGE_DEFAULT;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: HISTORIAL_LIMIT_MAX,
    default: HISTORIAL_LIMIT_DEFAULT,
    description: 'Cantidad de eventos por página',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor a 0' })
  @Max(HISTORIAL_LIMIT_MAX, {
    message: `limit no puede exceder ${HISTORIAL_LIMIT_MAX} registros por página`,
  })
  limit?: number = HISTORIAL_LIMIT_DEFAULT;
}
