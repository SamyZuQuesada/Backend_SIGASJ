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

  if (typeof raw === 'number') {
    return raw;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') {
      return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) ? parsed : raw;
  }

  return raw;
};

export class QueryCategoriasDto {
  @ApiPropertyOptional({
    description:
      'Filtrar categorías por estado activo (true para operativas, false para inactivas)',
    example: true,
  })
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'El filtro de estado activo debe ser un valor booleano',
  })
  activo?: boolean;

  @ApiPropertyOptional({
    description: 'Búsqueda por nombre de la categoría (coincidencia parcial)',
    example: 'Tubo',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto' })
  @MaxLength(100, {
    message: 'El término de búsqueda no puede exceder 100 caracteres',
  })
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Número de página para resultados paginados',
    example: 1,
    default: 1,
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de categorías por página',
    example: 20,
    default: 20,
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(100, { message: 'El límite no puede exceder 100 elementos por página' })
  limit?: number = 20;
}
