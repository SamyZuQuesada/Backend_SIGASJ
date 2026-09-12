import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoAveria } from '../../../common/enums/estado-averia.enum';

export const ADMIN_AVERIAS_PAGE_DEFAULT = 1;
export const ADMIN_AVERIAS_LIMIT_DEFAULT = 20;
export const ADMIN_AVERIAS_LIMIT_MAX = 100;
/** Query token: filtra `prioridad IS NULL`. No se persiste como valor de columna. */
export const ADMIN_AVERIAS_PRIORIDAD_SIN_ASIGNAR = 'SIN_ASIGNAR';

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

const toOptionalEstado = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed === '' ? undefined : trimmed.toUpperCase();
  }
  return raw;
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
    if (trimmed === '') {
      return undefined;
    }
    if (!/^-?\d+$/.test(trimmed)) {
      return Number.NaN;
    }
    return parseInt(trimmed, 10);
  }

  return raw;
};

/**
 * Query del listado administrativo de averías.
 * page default 1, limit default 20, max 100: no hay DTO genérico de paginación
 * en SIGASJ; se reutiliza el techo de inventario (categorías/proveedores).
 */
export class QueryAveriasAdminDto {
  @ApiPropertyOptional({
    description: 'Número de página (inicia en 1)',
    example: 1,
    minimum: 1,
    default: ADMIN_AVERIAS_PAGE_DEFAULT,
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number = ADMIN_AVERIAS_PAGE_DEFAULT;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por página',
    example: 20,
    minimum: 1,
    maximum: ADMIN_AVERIAS_LIMIT_MAX,
    default: ADMIN_AVERIAS_LIMIT_DEFAULT,
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(ADMIN_AVERIAS_LIMIT_MAX, {
    message: `limit no puede exceder ${ADMIN_AVERIAS_LIMIT_MAX} registros por página`,
  })
  limit?: number = ADMIN_AVERIAS_LIMIT_DEFAULT;

  @ApiPropertyOptional({
    description:
      'Búsqueda parcial por codigoSeguimiento o nombreReportante (SQL LIKE)',
    example: 'AV-2026-0001',
    maxLength: 150,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'search debe ser una cadena de texto' })
  @MaxLength(150, { message: 'search no puede exceder 150 caracteres' })
  search?: string;

  @ApiPropertyOptional({
    enum: EstadoAveria,
    enumName: 'EstadoAveria',
    description:
      'Filtro por estado persistido. Hoy solo existe RECIBIDA; un valor fuera del enum produce 400.',
    example: EstadoAveria.RECIBIDA,
  })
  @Transform(toOptionalEstado)
  @IsOptional()
  @IsEnum(EstadoAveria, {
    message: `El estado debe ser uno de los permitidos: ${Object.values(EstadoAveria).join(', ')}`,
  })
  estado?: EstadoAveria;

  @ApiPropertyOptional({
    description:
      'Filtro exacto por la columna varchar `prioridad`. Use SIN_ASIGNAR para `prioridad IS NULL`. Si el parámetro no se envía, el listado general incluye null.',
    example: 'ALTA',
    maxLength: 40,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'prioridad debe ser una cadena de texto' })
  @MaxLength(40, { message: 'prioridad no puede exceder 40 caracteres' })
  prioridad?: string;

  @ApiPropertyOptional({
    description:
      'Filtro exacto por la columna varchar `tipoAveria`. No existe entidad TipoAveria; se filtra por el valor almacenado.',
    example: 'TUBERIA',
    maxLength: 80,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'tipo debe ser una cadena de texto' })
  @MaxLength(80, { message: 'tipo no puede exceder 80 caracteres' })
  tipo?: string;

  @ApiPropertyOptional({
    description:
      'ID numérico del Usuario con rol FONTANERO (`idFontaneroAsignado` / `Usuario.idUsuario`)',
    example: 5,
    minimum: 1,
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'fontaneroId debe ser un número entero' })
  @Min(1, { message: 'fontaneroId debe ser un entero positivo' })
  fontaneroId?: number;

  @ApiPropertyOptional({
    description:
      'Inicio inclusivo del rango sobre fechaReporte (día calendario YYYY-MM-DD)',
    example: '2026-09-01',
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
    example: '2026-09-12',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaHasta debe tener formato YYYY-MM-DD',
  })
  fechaHasta?: string;
}
