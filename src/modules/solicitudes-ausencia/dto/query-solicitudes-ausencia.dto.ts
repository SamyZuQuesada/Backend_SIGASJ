import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { EstadoSolicitudAusencia } from '../../../common/enums/estado-solicitud-ausencia.enum';
import { TipoSolicitudAusencia } from '../../../common/enums/tipo-solicitud-ausencia.enum';

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

const toOptionalInt = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed === '' ? undefined : Number(trimmed);
  }
  return raw;
};

const trimUpper = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  return typeof raw === 'string' ? raw.trim().toUpperCase() : raw;
};

export const SOLICITUDES_AUSENCIA_PAGE_DEFAULT = 1;
export const SOLICITUDES_AUSENCIA_LIMIT_DEFAULT = 10;
export const SOLICITUDES_AUSENCIA_LIMIT_MAX = 100;

export class QuerySolicitudesAusenciaDto {
  @ApiPropertyOptional({ enum: EstadoSolicitudAusencia })
  @Transform(trimUpper)
  @IsOptional()
  @IsEnum(EstadoSolicitudAusencia)
  estado?: EstadoSolicitudAusencia;

  @ApiPropertyOptional({ enum: TipoSolicitudAusencia })
  @Transform(trimUpper)
  @IsOptional()
  @IsEnum(TipoSolicitudAusencia)
  tipo?: TipoSolicitudAusencia;

  @ApiPropertyOptional()
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt()
  @Min(1)
  colaboradorId?: number;

  @ApiPropertyOptional({ default: SOLICITUDES_AUSENCIA_PAGE_DEFAULT })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = SOLICITUDES_AUSENCIA_PAGE_DEFAULT;

  @ApiPropertyOptional({ default: SOLICITUDES_AUSENCIA_LIMIT_DEFAULT })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(SOLICITUDES_AUSENCIA_LIMIT_MAX)
  limit?: number = SOLICITUDES_AUSENCIA_LIMIT_DEFAULT;
}
