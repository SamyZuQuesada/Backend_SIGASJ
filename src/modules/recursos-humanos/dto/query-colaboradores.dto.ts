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

export const COLABORADORES_PAGE_DEFAULT = 1;
export const COLABORADORES_LIMIT_DEFAULT = 10;

export class QueryColaboradoresDto {
  @ApiPropertyOptional({
    example: 'Pérez',
    maxLength: 100,
    description:
      'Búsqueda parcial general en nombre, apellidos o cédula (la cédula se compara con o sin guiones)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto' })
  @MaxLength(100, {
    message: 'El término de búsqueda no puede exceder 100 caracteres',
  })
  search?: string;

  @ApiPropertyOptional({
    example: 'Carlos',
    maxLength: 100,
    description: 'Búsqueda parcial por nombre',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombre?: string;

  @ApiPropertyOptional({
    example: 'Mora',
    maxLength: 100,
    description: 'Búsqueda parcial por apellidos',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'Los apellidos deben ser una cadena de texto' })
  @MaxLength(100, { message: 'Los apellidos no pueden exceder 100 caracteres' })
  apellidos?: string;

  @ApiPropertyOptional({
    example: '1-1234',
    maxLength: 30,
    description: 'Búsqueda parcial por cédula, con o sin guiones',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'La cédula debe ser una cadena de texto' })
  @MaxLength(30, { message: 'La cédula no puede exceder 30 caracteres' })
  cedula?: string;

  @ApiPropertyOptional({
    example: 'Fontanero',
    maxLength: 100,
    description: 'Filtro exacto por cargo (sin distinguir mayúsculas)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'El cargo debe ser una cadena de texto' })
  @MaxLength(100, { message: 'El cargo no puede exceder 100 caracteres' })
  cargo?: string;

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
    default: COLABORADORES_PAGE_DEFAULT,
    description: 'Número de página',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number = COLABORADORES_PAGE_DEFAULT;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: COLABORADORES_LIMIT_DEFAULT,
    description: 'Cantidad de registros por página',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor a 0' })
  @Max(100, { message: 'limit no puede exceder 100 registros por página' })
  limit?: number = COLABORADORES_LIMIT_DEFAULT;
}
