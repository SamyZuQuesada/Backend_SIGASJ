import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';

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

/** Rango opcional del resumen. El conteo usa fechaReporte, no la fecha de resolución. */
export class QueryReporteResumenAveriasDto {
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
}
