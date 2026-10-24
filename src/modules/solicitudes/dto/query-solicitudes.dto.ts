import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { EstadoSolicitud } from '../../../common/enums/estado-solicitud.enum';

/**
 * Parámetros de consulta y filtrado para el listado administrativo de solicitudes digitales.
 * Soporta filtros individuales y combinados para el trabajo del personal de la ASADA.
 */
export class QuerySolicitudesDto {
  @ApiPropertyOptional({
    description: 'Filtrar por ID del tipo de solicitud',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tipoSolicitudId?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por slug del tipo de solicitud',
    example: 'arreglo-pago',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado actual de la solicitud',
    enum: EstadoSolicitud,
    example: EstadoSolicitud.PENDIENTE,
  })
  @IsOptional()
  @IsEnum(EstadoSolicitud)
  estado?: EstadoSolicitud;

  @ApiPropertyOptional({
    description:
      'Filtrar por código de seguimiento público (coincidencia parcial o exacta)',
    example: 'SOL-2026-A82K91',
  })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiPropertyOptional({
    description: 'Alias para el filtro de código de seguimiento',
    example: 'SOL-2026-A82K91',
  })
  @IsOptional()
  @IsString()
  codigoSeguimiento?: string;

  @ApiPropertyOptional({
    description:
      'Fecha inicial para filtrar solicitudes por fecha de ingreso (formato YYYY-MM-DD o ISO)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @ApiPropertyOptional({
    description:
      'Fecha final para filtrar solicitudes por fecha de ingreso (formato YYYY-MM-DD o ISO)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar por número de identificación o cédula del solicitante (física, jurídica o representante)',
    example: '1-1234-0567',
  })
  @IsOptional()
  @IsString()
  identificacion?: string;

  @ApiPropertyOptional({
    description:
      'Dirección de ordenamiento cronológico por fecha de ingreso (DESC por defecto para ver las más recientes primero)',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  orden?: 'ASC' | 'DESC' | 'asc' | 'desc' = 'DESC';

  @ApiPropertyOptional({
    description: 'Número de página para paginación',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de elementos por página',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
