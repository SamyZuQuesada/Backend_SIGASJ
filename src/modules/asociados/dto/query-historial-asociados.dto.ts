import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
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

const trimOptionalUpperString = (params: TransformFnParams): unknown => {
  const value = trimOptionalString(params);
  return typeof value === 'string' ? value.toUpperCase() : value;
};

const toOptionalBoolean = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase();
    if (
      lower === 'true' ||
      lower === '1' ||
      lower === 'activo' ||
      lower === 'activos'
    ) {
      return true;
    }
    if (
      lower === 'false' ||
      lower === '0' ||
      lower === 'inactivo' ||
      lower === 'inactivos'
    ) {
      return false;
    }
    return raw;
  }
  if (raw === true || raw === 1) {
    return true;
  }
  if (raw === false || raw === 0) {
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

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export enum OrdenHistorial {
  ASC = 'ASC',
  DESC = 'DESC',
}

export const HISTORIAL_ASOCIADOS_PAGE_DEFAULT = 1;
export const HISTORIAL_ASOCIADOS_LIMIT_DEFAULT = 10;
export const HISTORIAL_ASOCIADOS_LIMIT_MAX = 100;

export class QueryHistorialAsociadosDto {
  @ApiPropertyOptional({
    example: 'Juan',
    maxLength: 100,
    description:
      'Filtro específico por nombre del asociado (coincidencia parcial)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'nombre debe ser una cadena de texto' })
  @MaxLength(100, { message: 'nombre no puede exceder 100 caracteres' })
  nombre?: string;

  @ApiPropertyOptional({
    example: 'Pérez',
    maxLength: 100,
    description:
      'Filtro específico por apellidos del asociado (coincidencia parcial)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'apellidos debe ser una cadena de texto' })
  @MaxLength(100, { message: 'apellidos no puede exceder 100 caracteres' })
  apellidos?: string;

  @ApiPropertyOptional({
    example: '1-1234-0567',
    maxLength: 30,
    description:
      'Filtro específico por cédula del asociado (con o sin guiones)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'cedula debe ser una cadena de texto' })
  @MaxLength(30, { message: 'cedula no puede exceder 30 caracteres' })
  cedula?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Filtro por estado (true = solo activos, false = solo inactivos, omitido = activos e inactivos)',
  })
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean({ message: 'El filtro activo debe ser true o false' })
  activo?: boolean;

  @ApiPropertyOptional({
    example: 'activo',
    description: 'Filtro por estado en formato texto ("activo" / "inactivo")',
  })
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser activo o inactivo' })
  estado?: boolean;

  @ApiPropertyOptional({
    example: '2026-01-15',
    description: 'Filtro por fecha de registro formal exacta (YYYY-MM-DD)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'fechaRegistro debe ser una cadena de texto' })
  @Matches(FECHA_ISO, {
    message: 'fechaRegistro debe tener formato YYYY-MM-DD',
  })
  fechaRegistro?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Fecha mínima de registro formal (YYYY-MM-DD)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'fechaRegistroDesde debe ser una cadena de texto' })
  @Matches(FECHA_ISO, {
    message: 'fechaRegistroDesde debe tener formato YYYY-MM-DD',
  })
  fechaRegistroDesde?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Fecha máxima de registro formal (YYYY-MM-DD)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'fechaRegistroHasta debe ser una cadena de texto' })
  @Matches(FECHA_ISO, {
    message: 'fechaRegistroHasta debe tener formato YYYY-MM-DD',
  })
  fechaRegistroHasta?: string;

  @ApiPropertyOptional({
    example: '2026-05-10',
    description: 'Filtro por fecha de inactivación formal exacta (YYYY-MM-DD)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'fechaInactivacion debe ser una cadena de texto' })
  @Matches(FECHA_ISO, {
    message: 'fechaInactivacion debe tener formato YYYY-MM-DD',
  })
  fechaInactivacion?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Fecha mínima de inactivación (YYYY-MM-DD)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'fechaInactivacionDesde debe ser una cadena de texto' })
  @Matches(FECHA_ISO, {
    message: 'fechaInactivacionDesde debe tener formato YYYY-MM-DD',
  })
  fechaInactivacionDesde?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Fecha máxima de inactivación (YYYY-MM-DD)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'fechaInactivacionHasta debe ser una cadena de texto' })
  @Matches(FECHA_ISO, {
    message: 'fechaInactivacionHasta debe tener formato YYYY-MM-DD',
  })
  fechaInactivacionHasta?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description:
      'Alias histórico general para fecha de registro mínima (YYYY-MM-DD)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'fechaDesde debe ser una cadena de texto' })
  @Matches(FECHA_ISO, { message: 'fechaDesde debe tener formato YYYY-MM-DD' })
  fechaDesde?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description:
      'Alias histórico general para fecha de registro máxima (YYYY-MM-DD)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'fechaHasta debe ser una cadena de texto' })
  @Matches(FECHA_ISO, { message: 'fechaHasta debe tener formato YYYY-MM-DD' })
  fechaHasta?: string;

  @ApiPropertyOptional({
    example: 'Pérez',
    maxLength: 100,
    description:
      'Búsqueda general en nombre, apellidos o cédula (con o sin guiones)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto' })
  @MaxLength(100, {
    message: 'El término de búsqueda no puede exceder 100 caracteres',
  })
  search?: string;

  @ApiPropertyOptional({
    enum: OrdenHistorial,
    default: OrdenHistorial.ASC,
    description:
      'Dirección de ordenamiento alfabético por apellidos y nombre (ASC o DESC)',
  })
  @Transform(trimOptionalUpperString)
  @IsOptional()
  @IsEnum(OrdenHistorial, { message: 'orden debe ser ASC o DESC' })
  orden?: OrdenHistorial = OrdenHistorial.ASC;

  @ApiPropertyOptional({
    minimum: 1,
    default: HISTORIAL_ASOCIADOS_PAGE_DEFAULT,
    description: 'Número de página',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number = HISTORIAL_ASOCIADOS_PAGE_DEFAULT;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: HISTORIAL_ASOCIADOS_LIMIT_MAX,
    default: HISTORIAL_ASOCIADOS_LIMIT_DEFAULT,
    description: 'Cantidad de registros por página',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor a 0' })
  @Max(HISTORIAL_ASOCIADOS_LIMIT_MAX, {
    message: `limit no puede exceder ${HISTORIAL_ASOCIADOS_LIMIT_MAX} registros por página`,
  })
  limit?: number = HISTORIAL_ASOCIADOS_LIMIT_DEFAULT;
}
