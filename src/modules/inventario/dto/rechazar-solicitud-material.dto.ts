import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

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

/** Motivo opcional al rechazar una solicitud de materiales. */
export class RechazarSolicitudMaterialDto {
  @ApiPropertyOptional({
    example: 'Material no justificado para la labor indicada',
    description: 'Motivo del rechazo. Opcional mientras la ASADA no lo exija.',
    maxLength: 500,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'El motivo de rechazo debe ser texto' })
  @MaxLength(500, {
    message: 'El motivo de rechazo no puede superar 500 caracteres',
  })
  motivoRechazo?: string;
}
