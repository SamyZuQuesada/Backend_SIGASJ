import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const OBSERVACION_AVERIA_MAX_LENGTH = 2000;
export const OBSERVACION_AVERIA_VACIA =
  'Ingrese una observación antes de guardar.';
export const OBSERVACION_AVERIA_REGISTRADA =
  'Observación registrada correctamente.';

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

const trimObservacion = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  return typeof raw === 'string' ? raw.trim() : raw;
};

export class CreateObservacionAveriaDto {
  @ApiProperty({
    example: 'Se revisó la ubicación y se identificó la fuga.',
    maxLength: OBSERVACION_AVERIA_MAX_LENGTH,
    description: 'Texto de la observación de atención. Se recortan espacios.',
  })
  @Transform(trimObservacion)
  @IsString({ message: OBSERVACION_AVERIA_VACIA })
  @IsNotEmpty({ message: OBSERVACION_AVERIA_VACIA })
  @MaxLength(OBSERVACION_AVERIA_MAX_LENGTH, {
    message: `La observación no puede superar ${OBSERVACION_AVERIA_MAX_LENGTH} caracteres.`,
  })
  observacion: string;
}
