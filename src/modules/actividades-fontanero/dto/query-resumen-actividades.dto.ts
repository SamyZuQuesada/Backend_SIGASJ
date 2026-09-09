import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsDateString, IsOptional } from 'class-validator';

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

/** Filtros opcionales del resumen de actividades (dashboard). */
export class QueryResumenActividadesDto {
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
}
