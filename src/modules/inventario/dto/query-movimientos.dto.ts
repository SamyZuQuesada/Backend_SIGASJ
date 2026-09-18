import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { TipoMovimientoInventario } from '../../../common/enums/tipo-movimiento-inventario.enum';

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
    if (trimmed === '') return undefined;
    if (!/^-?\d+$/.test(trimmed)) {
      return Number.NaN;
    }
    return parseInt(trimmed, 10);
  }
  return raw;
};

const normalizeTipoMovimiento = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'string') {
    return raw.trim().toUpperCase();
  }
  return raw;
};

export class QueryMovimientosDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  page?: number;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(100, { message: 'El límite máximo permitido es 100 registros' })
  limit?: number;

  @ApiPropertyOptional({ enum: TipoMovimientoInventario })
  @IsOptional()
  @Transform(normalizeTipoMovimiento)
  @IsEnum(TipoMovimientoInventario, {
    message: `El tipo debe ser uno de: ${Object.values(TipoMovimientoInventario).join(', ')}`,
  })
  tipo?: TipoMovimientoInventario;

  @ApiPropertyOptional({ example: 4, minimum: 1 })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'idMaterial debe ser un número entero' })
  @Min(1, { message: 'idMaterial debe ser mayor a cero' })
  idMaterial?: number;

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'idUsuario debe ser un número entero' })
  @Min(1, { message: 'idUsuario debe ser mayor a cero' })
  idUsuario?: number;

  @ApiPropertyOptional({ example: 12, minimum: 1 })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'idAveria debe ser un número entero' })
  @Min(1, { message: 'idAveria debe ser mayor a cero' })
  idAveria?: number;

  @ApiPropertyOptional({ example: 8, minimum: 1 })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'idSolicitud debe ser un número entero' })
  @Min(1, { message: 'idSolicitud debe ser mayor a cero' })
  idSolicitud?: number;

  @ApiPropertyOptional({ example: 5, minimum: 1 })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'idReposicion debe ser un número entero' })
  @Min(1, { message: 'idReposicion debe ser mayor a cero' })
  idReposicion?: number;

  @ApiPropertyOptional({
    description: 'Inicio inclusivo del rango sobre fechaMovimiento (YYYY-MM-DD)',
    example: '2026-09-01',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaDesde debe tener formato YYYY-MM-DD',
  })
  fechaDesde?: string;

  @ApiPropertyOptional({
    description: 'Fin inclusivo del rango sobre fechaMovimiento (YYYY-MM-DD)',
    example: '2026-09-18',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaHasta debe tener formato YYYY-MM-DD',
  })
  fechaHasta?: string;
}
