import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { OBSERVACION_AVERIA_MAX_LENGTH } from './create-observacion-averia.dto';

export const OBSERVACION_FINAL_VACIA =
  'Registre una observación sobre la atención realizada antes de resolver la avería.';
export const AVERIA_NO_EN_ATENCION =
  'La avería debe encontrarse en atención antes de poder marcarse como resuelta.';
export const AVERIA_FONTANERO_RESOLVER_FORBIDDEN =
  'No tiene autorización para resolver esta avería.';
export const AVERIA_RESOLVER_ERROR =
  'No fue posible completar la resolución de la avería. Intente nuevamente.';
export const AVERIA_RESUELTA_OK = 'La avería fue marcada como resuelta.';

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

const trimObservacionFinal = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  return typeof raw === 'string' ? raw.trim() : raw;
};

export class ResolverAveriaDto {
  @ApiProperty({
    example:
      'Se reemplazó el tramo dañado y se verificó que no continúe la fuga.',
    maxLength: OBSERVACION_AVERIA_MAX_LENGTH,
    description:
      'Observación final de la atención. El estado y la fecha de resolución no se envían.',
  })
  @Transform(trimObservacionFinal)
  @IsString({ message: OBSERVACION_FINAL_VACIA })
  @IsNotEmpty({ message: OBSERVACION_FINAL_VACIA })
  @MaxLength(OBSERVACION_AVERIA_MAX_LENGTH, {
    message: `La observación no puede superar ${OBSERVACION_AVERIA_MAX_LENGTH} caracteres.`,
  })
  observacionFinal: string;
}
