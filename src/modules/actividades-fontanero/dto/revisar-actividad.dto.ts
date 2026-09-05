import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoActividadFontanero } from '../../../common/enums/estado-actividad-fontanero.enum';

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

const ESTADOS_REVISION = [
  EstadoActividadFontanero.EN_REVISION,
  EstadoActividadFontanero.APROBADA,
  EstadoActividadFontanero.RECHAZADA,
] as const;

export class RevisarActividadDto {
  @ApiPropertyOptional({
    enum: ESTADOS_REVISION,
    example: EstadoActividadFontanero.EN_REVISION,
  })
  @IsEnum(ESTADOS_REVISION, {
    message: 'El estado de revisión no es válido',
  })
  estado: (typeof ESTADOS_REVISION)[number];

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacion?: string;
}
