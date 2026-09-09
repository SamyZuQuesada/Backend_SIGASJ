import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  Max,
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
 * Consulta histórica del Fontanero autenticado.
 * No incluye fontaneroId: la identidad sale únicamente del JWT.
 */
export class QueryHistorialActividadesDto {
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
    example: 1,
    description: 'Página solicitada. Default 1. Mínimo 1.',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Tamaño de página. Default 10. Mínimo 1, máximo 50.',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(50, { message: 'limit no puede ser mayor a 50' })
  limit?: number;
}
