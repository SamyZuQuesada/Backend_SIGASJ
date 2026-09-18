import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
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

export class QueryReporteInventarioDto {
  @ApiPropertyOptional({ example: 4, minimum: 1 })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'idMaterial debe ser un número entero' })
  @Min(1, { message: 'idMaterial debe ser mayor a cero' })
  idMaterial?: number;

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'idCategoria debe ser un número entero' })
  @Min(1, { message: 'idCategoria debe ser mayor a cero' })
  idCategoria?: number;

  @ApiPropertyOptional({ enum: TipoMovimientoInventario })
  @IsOptional()
  @Transform(normalizeTipoMovimiento)
  @IsEnum(TipoMovimientoInventario, {
    message: `El tipo debe ser uno de: ${Object.values(TipoMovimientoInventario).join(', ')}`,
  })
  tipo?: TipoMovimientoInventario;

  @ApiPropertyOptional({
    description: 'Inicio inclusivo del periodo sobre fechaMovimiento (YYYY-MM-DD)',
    example: '2026-08-01',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaDesde debe tener formato YYYY-MM-DD',
  })
  fechaDesde?: string;

  @ApiPropertyOptional({
    description: 'Fin inclusivo del periodo sobre fechaMovimiento (YYYY-MM-DD)',
    example: '2026-08-31',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaHasta debe tener formato YYYY-MM-DD',
  })
  fechaHasta?: string;
}
