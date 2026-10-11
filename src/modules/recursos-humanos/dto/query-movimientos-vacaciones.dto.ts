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
  TIPOS_MOVIMIENTO_VACACIONES,
  TipoMovimientoVacaciones,
} from '../../../common/enums/tipo-movimiento-vacaciones.enum';

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

export const MOVIMIENTOS_VACACIONES_PAGE_DEFAULT = 1;
export const MOVIMIENTOS_VACACIONES_LIMIT_DEFAULT = 10;

export class QueryMovimientosVacacionesDto {
  @ApiPropertyOptional({
    example: 3,
    description: 'Filtrar por colaborador',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'colaboradorId debe ser un número entero' })
  @Min(1, { message: 'colaboradorId debe ser un identificador válido' })
  colaboradorId?: number;

  @ApiPropertyOptional({
    enum: TipoMovimientoVacaciones,
    description: 'Filtrar por tipo de movimiento',
  })
  @Transform(trimOptionalUpperString)
  @IsOptional()
  @IsEnum(TipoMovimientoVacaciones, {
    message: `tipo debe ser ${TIPOS_MOVIMIENTO_VACACIONES.join(' o ')}`,
  })
  tipo?: TipoMovimientoVacaciones;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description:
      'Incluir solo movimientos con fecha igual o posterior (YYYY-MM-DD)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'fechaInicio debe ser una cadena de texto' })
  @Matches(FECHA_ISO, {
    message: 'fechaInicio debe tener formato YYYY-MM-DD',
  })
  fechaInicio?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description:
      'Incluir solo movimientos con fecha igual o anterior (YYYY-MM-DD)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'fechaFin debe ser una cadena de texto' })
  @Matches(FECHA_ISO, {
    message: 'fechaFin debe tener formato YYYY-MM-DD',
  })
  fechaFin?: string;

  @ApiPropertyOptional({
    minimum: 1,
    default: MOVIMIENTOS_VACACIONES_PAGE_DEFAULT,
    description: 'Número de página',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number = MOVIMIENTOS_VACACIONES_PAGE_DEFAULT;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: MOVIMIENTOS_VACACIONES_LIMIT_DEFAULT,
    description: 'Cantidad de registros por página',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor a 0' })
  @Max(100, { message: 'limit no puede exceder 100 registros por página' })
  limit?: number = MOVIMIENTOS_VACACIONES_LIMIT_DEFAULT;
}
