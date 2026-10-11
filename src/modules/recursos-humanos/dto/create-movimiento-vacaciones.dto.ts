import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  TIPOS_MOVIMIENTO_VACACIONES,
  TipoMovimientoVacaciones,
} from '../../../common/enums/tipo-movimiento-vacaciones.enum';

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

const trimString = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  return typeof raw === 'string' ? raw.trim() : raw;
};

const trimUpperString = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  return typeof raw === 'string' ? raw.trim().toUpperCase() : raw;
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
  return trimmed === '' ? null : trimmed;
};

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export class CreateMovimientoVacacionesDto {
  @ApiProperty({
    example: 3,
    description:
      'Identificador del colaborador al que se registra el movimiento',
  })
  @IsInt({
    message: 'El colaborador debe ser un identificador numérico entero',
  })
  @Min(1, { message: 'El colaborador debe ser un identificador válido' })
  colaboradorId: number;

  @ApiProperty({
    enum: TipoMovimientoVacaciones,
    example: TipoMovimientoVacaciones.ACUMULADO,
    description:
      'ACUMULADO suma días al saldo del colaborador; DISFRUTADO los resta',
  })
  @Transform(trimUpperString)
  @IsEnum(TipoMovimientoVacaciones, {
    message: `El tipo de movimiento debe ser ${TIPOS_MOVIMIENTO_VACACIONES.join(' o ')}`,
  })
  tipo: TipoMovimientoVacaciones;

  @ApiProperty({
    example: 5,
    minimum: 1,
    description:
      'Cantidad de días del movimiento. Debe ser un entero mayor a cero',
  })
  @IsInt({ message: 'La cantidad de días debe ser un número entero' })
  @Min(1, { message: 'La cantidad de días debe ser mayor a cero' })
  cantidadDias: number;

  @ApiProperty({
    example: '2026-10-12',
    description: 'Fecha en que aplica el movimiento (YYYY-MM-DD)',
  })
  @Transform(trimString)
  @IsString({ message: 'La fecha debe ser una cadena de texto' })
  @Matches(FECHA_ISO, { message: 'La fecha debe tener formato YYYY-MM-DD' })
  fecha: string;

  @ApiPropertyOptional({
    example: 'Vacaciones de fin de año',
    maxLength: 500,
    nullable: true,
    description: 'Observaciones opcionales del registro',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto' })
  @MaxLength(500, {
    message: 'Las observaciones no pueden exceder 500 caracteres',
  })
  observaciones?: string | null;
}
