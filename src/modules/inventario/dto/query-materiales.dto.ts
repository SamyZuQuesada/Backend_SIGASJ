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
    return Number(trimmed);
  }

  return raw;
};

export class QueryMaterialesDto {
  @ApiPropertyOptional({
    example: 'Tubo',
    maxLength: 150,
    description: 'Búsqueda parcial por nombre del material',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto' })
  @MaxLength(150, {
    message: 'El término de búsqueda no puede exceder 150 caracteres',
  })
  nombre?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Filtro por estado (true = solo activos, false = solo inactivos, omitido = todos)',
  })
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean({ message: 'El filtro activo debe ser un valor booleano' })
  activo?: boolean;

  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
    example: 1,
    description: 'Número de página a consultar',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: 10,
    example: 10,
    description: 'Cantidad de registros por página',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor a 0' })
  @Max(100, { message: 'limit no puede exceder 100 registros por página' })
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filtrar materiales por identificador de categoría',
  })
  @Transform((params: TransformFnParams) => {
    const raw = rawValue(params);
    if (raw === undefined || raw === null || raw === '') return undefined;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const parsed = Number(raw.trim());
      return Number.isInteger(parsed) ? parsed : raw;
    }
    return raw;
  })
  @IsOptional()
  @IsInt({ message: 'idCategoria debe ser un número entero' })
  @Min(1, { message: 'idCategoria debe ser mayor a cero' })
  idCategoria?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Alias de idCategoria para filtrar materiales por categoría (compatibilidad)',
  })
  @Transform((params: TransformFnParams) => {
    const raw = rawValue(params);
    if (raw === undefined || raw === null || raw === '') return undefined;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const parsed = Number(raw.trim());
      return Number.isInteger(parsed) ? parsed : raw;
    }
    return raw;
  })
  @IsOptional()
  @IsInt({ message: 'idCategoria debe ser un número entero' })
  @Min(1, { message: 'idCategoria debe ser mayor a cero' })
  categoriaId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filtrar materiales por identificador de proveedor',
  })
  @Transform((params: TransformFnParams) => {
    const raw = rawValue(params);
    if (raw === undefined || raw === null || raw === '') return undefined;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const parsed = Number(raw.trim());
      return Number.isInteger(parsed) ? parsed : raw;
    }
    return raw;
  })
  @IsOptional()
  @IsInt({ message: 'idProveedor debe ser un número entero' })
  @Min(1, { message: 'idProveedor debe ser mayor a cero' })
  idProveedor?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Alias de idProveedor para filtrar materiales por proveedor (compatibilidad)',
  })
  @Transform((params: TransformFnParams) => {
    const raw = rawValue(params);
    if (raw === undefined || raw === null || raw === '') return undefined;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const parsed = Number(raw.trim());
      return Number.isInteger(parsed) ? parsed : raw;
    }
    return raw;
  })
  @IsOptional()
  @IsInt({ message: 'idProveedor debe ser un número entero' })
  @Min(1, { message: 'idProveedor debe ser mayor a cero' })
  proveedorId?: number;
}
