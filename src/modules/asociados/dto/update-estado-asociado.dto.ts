import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** Igual al largo de la columna Asociado.motivoInactivacion. */
export const MOTIVO_INACTIVACION_MAX_LENGTH = 500;

// La conversión implícita global convertiría "false" en true; se valida el valor crudo.
const valorCrudo = ({ value, obj, key }: TransformFnParams): unknown =>
  obj && typeof obj === 'object' && key in obj
    ? (obj as Record<string, unknown>)[key]
    : value;

const trimString = (params: TransformFnParams): unknown => {
  const raw = valorCrudo(params);
  return typeof raw === 'string' ? raw.trim() : raw;
};

export const MOTIVO_INACTIVACION_OBLIGATORIO =
  'El motivo de inactivación es obligatorio';

export class UpdateEstadoAsociadoDto {
  @ApiProperty({
    example: false,
    description: 'true para reactivar, false para inactivar',
  })
  @Transform(valorCrudo)
  @IsDefined({ message: 'El estado activo es obligatorio' })
  @IsBoolean({ message: 'El estado activo debe ser true o false' })
  activo: boolean;

  @ApiPropertyOptional({
    example: 'Venta de la propiedad',
    maxLength: MOTIVO_INACTIVACION_MAX_LENGTH,
    description:
      'Motivo de la inactivación. Obligatorio cuando activo es false; se ignora al reactivar.',
  })
  @ValidateIf((dto: UpdateEstadoAsociadoDto) => dto.activo === false)
  @Transform(trimString)
  @IsDefined({ message: MOTIVO_INACTIVACION_OBLIGATORIO })
  @IsString({
    message: 'El motivo de inactivación debe ser una cadena de texto',
  })
  @IsNotEmpty({ message: MOTIVO_INACTIVACION_OBLIGATORIO })
  @MaxLength(MOTIVO_INACTIVACION_MAX_LENGTH, {
    message: `El motivo de inactivación no puede exceder ${MOTIVO_INACTIVACION_MAX_LENGTH} caracteres`,
  })
  motivo?: string;
}
