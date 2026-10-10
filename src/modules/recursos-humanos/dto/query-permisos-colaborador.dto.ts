import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
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
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed === '' ? undefined : Number(trimmed);
  }
  return raw;
};

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export const PERMISOS_PAGE_DEFAULT = 1;
export const PERMISOS_LIMIT_DEFAULT = 10;

export class QueryPermisosColaboradorDto {
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
    example: '2026-10-01',
    description:
      'Inicio del periodo a consultar (YYYY-MM-DD). Incluye permisos que aún no han terminado antes de esta fecha',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'fechaInicio debe ser una cadena de texto' })
  @Matches(FECHA_ISO, {
    message: 'fechaInicio debe tener formato YYYY-MM-DD',
  })
  fechaInicio?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description:
      'Fin del periodo a consultar (YYYY-MM-DD). Incluye permisos que ya habían iniciado en o antes de esta fecha',
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
    default: PERMISOS_PAGE_DEFAULT,
    description: 'Número de página',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number = PERMISOS_PAGE_DEFAULT;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: PERMISOS_LIMIT_DEFAULT,
    description: 'Cantidad de registros por página',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor a 0' })
  @Max(100, { message: 'limit no puede exceder 100 registros por página' })
  limit?: number = PERMISOS_LIMIT_DEFAULT;
}
