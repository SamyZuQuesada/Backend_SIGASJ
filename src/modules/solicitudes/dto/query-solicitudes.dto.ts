import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { EstadoSolicitud } from '../../../common/enums/estado-solicitud.enum';

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
