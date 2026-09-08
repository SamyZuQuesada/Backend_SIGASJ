import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

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
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') {
      return undefined;
    }
    return Number(trimmed);
  }
  return raw;
};

/**
 * Filtros opcionales del reporte administrativo de actividades.
 * `fontaneroId` es string (JWT `sub`), no PK numérica de Usuario.
 */
export class QueryReporteActividadesDto {
  @ApiPropertyOptional({
    example: '2026-09-01',
    description:
      'Incluye actividades desde esta fecha (YYYY-MM-DD), inclusive.',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsDateString({}, { message: 'fechaInicio debe tener formato YYYY-MM-DD' })
  fechaInicio?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description:
      'Incluye actividades hasta esta fecha (YYYY-MM-DD), inclusive.',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsDateString({}, { message: 'fechaFin debe tener formato YYYY-MM-DD' })
  fechaFin?: string;

  @ApiPropertyOptional({
    example: 'fontanero-1',
    description: 'Identidad del fontanero (JWT sub / fontaneroId).',
    maxLength: 100,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'fontaneroId debe ser texto' })
  @MaxLength(100, { message: 'fontaneroId no puede superar 100 caracteres' })
  fontaneroId?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID del tipo de actividad del catálogo.',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'tipoActividadId debe ser un número entero' })
  @Min(1, { message: 'tipoActividadId debe ser mayor o igual a 1' })
  tipoActividadId?: number;
}
