import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
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

const toOptionalBoolean = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (raw === true || raw === 'true' || raw === '1' || raw === 1) {
    return true;
  }
  if (raw === false || raw === 'false' || raw === '0' || raw === 0) {
    return false;
  }
  return raw;
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

export const ASOCIADOS_PAGE_DEFAULT = 1;
export const ASOCIADOS_LIMIT_DEFAULT = 10;
export const ASOCIADOS_LIMIT_MAX = 100;

export class QueryAsociadosDto {
  @ApiPropertyOptional({
    example: 'Pérez',
    maxLength: 100,
    description:
      'Búsqueda parcial en nombre, apellidos o cédula (la cédula se compara con o sin guiones)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto' })
  @MaxLength(100, {
    message: 'El término de búsqueda no puede exceder 100 caracteres',
  })
  search?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Filtro por estado (true = solo activos, false = solo inactivos, omitido = todos)',
  })
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean({ message: 'El filtro activo debe ser true o false' })
  activo?: boolean;

  @ApiPropertyOptional({
    minimum: 1,
    default: ASOCIADOS_PAGE_DEFAULT,
    description: 'Número de página',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number = ASOCIADOS_PAGE_DEFAULT;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: ASOCIADOS_LIMIT_MAX,
    default: ASOCIADOS_LIMIT_DEFAULT,
    description: 'Cantidad de registros por página',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor a 0' })
  @Max(ASOCIADOS_LIMIT_MAX, {
    message: `limit no puede exceder ${ASOCIADOS_LIMIT_MAX} registros por página`,
  })
  limit?: number = ASOCIADOS_LIMIT_DEFAULT;
}
