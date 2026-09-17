import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { EstadoReposicionMaterial } from '../../../common/enums/estado-reposicion-material.enum';
import { OrigenReposicionMaterial } from '../../../common/enums/origen-reposicion-material.enum';

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
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

const normalizeEnumQuery = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'string') {
    return raw
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');
  }
  return raw;
};

export class QueryReposicionesDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  page?: number;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(100, { message: 'El límite máximo permitido es 100 registros' })
  limit?: number;

  @ApiPropertyOptional({ enum: EstadoReposicionMaterial })
  @IsOptional()
  @Transform(normalizeEnumQuery)
  @IsEnum(EstadoReposicionMaterial, {
    message: `El estado debe ser uno de: ${Object.values(EstadoReposicionMaterial).join(', ')}`,
  })
  estado?: EstadoReposicionMaterial;

  @ApiPropertyOptional({ enum: OrigenReposicionMaterial })
  @IsOptional()
  @Transform(normalizeEnumQuery)
  @IsEnum(OrigenReposicionMaterial, {
    message: `El origen debe ser uno de: ${Object.values(OrigenReposicionMaterial).join(', ')}`,
  })
  origen?: OrigenReposicionMaterial;
}
