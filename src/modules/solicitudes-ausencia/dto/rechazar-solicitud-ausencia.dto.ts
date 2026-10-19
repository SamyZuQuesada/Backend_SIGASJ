import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const trimOptional = ({ value }: TransformFnParams): unknown => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export class RechazarSolicitudAusenciaDto {
  @ApiPropertyOptional({
    example: 'No hay cobertura operativa esa semana',
    maxLength: 500,
  })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivoRechazo?: string | null;
}
