import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { EstadoActividadFontanero } from '../../../common/enums/estado-actividad-fontanero.enum';

export class QueryListadoActividadesAdminDto {
  @ApiPropertyOptional({
    description:
      'Filtrar por el ID del fontanero (UUID u otro identificador en texto)',
    example: 'fontanero-123',
  })
  @IsOptional()
  @IsString()
  fontaneroId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por el ID del tipo de actividad',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tipoActividadId?: number;

  @ApiPropertyOptional({
    description:
      'Fecha de inicio del rango de búsqueda (inclusivo, formato YYYY-MM-DD)',
    example: '2026-08-01',
  })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiPropertyOptional({
    description:
      'Fecha fin del rango de búsqueda (inclusivo, formato YYYY-MM-DD)',
    example: '2026-08-31',
  })
  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado de la actividad',
    enum: EstadoActividadFontanero,
    example: EstadoActividadFontanero.REPORTADA,
  })
  @IsOptional()
  @IsEnum(EstadoActividadFontanero)
  estado?: EstadoActividadFontanero;

  @ApiPropertyOptional({
    description: 'Número de página para la paginación (default: 1)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de elementos por página (default: 10, max: 100)',
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
