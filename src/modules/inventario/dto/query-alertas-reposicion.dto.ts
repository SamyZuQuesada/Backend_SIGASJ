import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { EstadoAlertaReposicion } from '../../../common/enums/estado-alerta-reposicion.enum';

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

export const transformEstadoAlertaReposicion = (
  params: TransformFnParams,
): unknown => {
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

export class QueryAlertasReposicionDto {
  @ApiPropertyOptional({
    description: 'Número de página para paginación (comienza en 1)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  page?: number;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por página',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(100, { message: 'El límite máximo permitido es 100 registros' })
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Filtro opcional por estado (PENDIENTE, EN_GESTION, RESUELTA). Acepta también "En gestión".',
    enum: EstadoAlertaReposicion,
    example: EstadoAlertaReposicion.PENDIENTE,
  })
  @IsOptional()
  @Transform(transformEstadoAlertaReposicion)
  @IsEnum(EstadoAlertaReposicion, {
    message: `El estado debe ser uno de los permitidos: ${Object.values(
      EstadoAlertaReposicion,
    ).join(', ')}`,
  })
  estado?: EstadoAlertaReposicion;
}
